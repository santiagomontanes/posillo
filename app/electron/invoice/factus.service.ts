let accessToken = '';
let lastAuthKey = '';

export type FactusConfig = {
  baseUrl: string;
  username: string;
  password: string;
  clientId: string;
  clientSecret: string;
};

type FactusNoteInput = {
  saleId: string;
  sale: any;
  reasonCode: string;
  reasonText?: string;
  mode?: 'full' | 'partial';
  amount?: number;
  sendEmail?: boolean;
};

const toFormUrlEncoded = (data: Record<string, string>) => {
  return new URLSearchParams(data).toString();
};

const normalizeText = (value: any, fallback = ''): string => {
  const text = String(value ?? fallback).trim();
  return text || fallback;
};

const normalizeNumber = (value: any, fallback = 0): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const mapPaymentMethodCode = (paymentMethod: string): string => {
  const value = normalizeText(paymentMethod).toUpperCase();
  if (value === 'EFECTIVO') return '10';
  if (value === 'TARJETA') return '48';
  if (value === 'BANCOLOMBIA') return '47';
  if (value === 'NEQUI') return '47';
  if (value === 'DAVIPLATA') return '47';
  return '1';
};

const buildAuthKey = (cfg: FactusConfig) => {
  return `${cfg.baseUrl}|${cfg.username}|${cfg.clientId}`;
};

const buildCustomerPayload = (sale: any) => ({
  identification: normalizeText(sale?.customer_id ?? sale?.customerId, '222222222222'),
  names: normalizeText(sale?.customer_name ?? sale?.customerName, 'Consumidor Final'),
  address: normalizeText(sale?.customer_address ?? sale?.customerAddress, 'No especificada'),
  email: normalizeText(sale?.customer_email ?? sale?.customerEmail, 'cliente@correo.com'),
  phone: normalizeText(sale?.customer_phone ?? sale?.customerPhone, '3000000000'),
  legal_organization_id: '2',
  tribute_id: '21',
  identification_document_id: 3,
});

const buildInvoiceItems = (items: any[]) =>
  items.map((item: any, index: number) => ({
    code_reference: normalizeText(
      item?.product_id ?? item?.productId ?? item?.id,
      `ITEM-${index + 1}`,
    ),
    name: normalizeText(
      item?.description ?? item?.name,
      `Producto ${index + 1}`,
    ),
    quantity: normalizeNumber(item?.qty, 1),
    discount_rate: 0,
    price: normalizeNumber(item?.unit_price, 0),
    tax_rate: '0.00',
    unit_measure_id: 70,
    standard_code_id: 1,
    is_excluded: 1,
    tribute_id: 1,
  }));

const buildSingleAdjustmentItem = (name: string, amount: number) => ([
  {
    code_reference: `AJ-${Date.now()}`,
    name,
    quantity: 1,
    discount_rate: 0,
    price: normalizeNumber(amount, 0),
    tax_rate: '0.00',
    unit_measure_id: 70,
    standard_code_id: 1,
    is_excluded: 1,
    tribute_id: 1,
  },
]);

async function factusRequest(cfg: FactusConfig, path: string, payload: any) {
  const token = await factusAuth(cfg);

  const res = await fetch(`${cfg.baseUrl}${path}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error('[FACTUS ERROR]', JSON.stringify(data, null, 2));
    throw new Error(data?.data?.message || data?.message || 'Error en Factus');
  }

  return data;
}

async function factusGet(cfg: FactusConfig, path: string) {
  const token = await factusAuth(cfg);

  const res = await fetch(`${cfg.baseUrl}${path}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await res.json();

  if (!res.ok) {
    console.error('[FACTUS GET ERROR]', JSON.stringify(data, null, 2));
    throw new Error(data?.data?.message || data?.message || 'Error consultando Factus');
  }

  return data;
}

export const factusAuth = async (cfg: FactusConfig): Promise<string> => {
  const key = buildAuthKey(cfg);

  if (accessToken && lastAuthKey === key) return accessToken;

  const res = await fetch(`${cfg.baseUrl}/oauth/token`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: toFormUrlEncoded({
      grant_type: 'password',
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      username: cfg.username,
      password: cfg.password,
    }),
  });

  const data = await res.json();

  if (!res.ok || !data?.access_token) {
    console.error('[FACTUS AUTH ERROR]', JSON.stringify(data, null, 2));
    throw new Error(data?.message || 'Error autenticando con Factus');
  }

  accessToken = data.access_token;
  lastAuthKey = key;

  return accessToken;
};

export const factusGetNumberingRange = async (
  cfg: FactusConfig,
  documentCode: 21 | 22 | 23,
): Promise<number | null> => {
  const data = await factusGet(
    cfg,
    `/v1/numbering-ranges?filter[document]=${documentCode}&filter[is_active]=1`,
  );

  const rows = Array.isArray(data?.data?.data) ? data.data.data : [];
  const active = rows.find((r: any) => Number(r?.is_active ?? 0) === 1);
  return active?.id != null ? Number(active.id) : null;
};

export const factusCreateInvoice = async (cfg: FactusConfig, payload: any) => {
  return await factusRequest(cfg, '/v1/bills/validate', payload);
};

export const factusCreateInvoiceFromSale = async (cfg: FactusConfig, sale: any) => {
  const items = Array.isArray(sale?.items) ? sale.items : [];

  if (!items.length) {
    throw new Error('La venta no tiene ítems para enviar a Factus.');
  }

  const payload = {
    document: '01',
    reference_code: normalizeText(sale?.invoiceNumber, `VENTA-${Date.now()}`),
    observation: `Factura generada desde Sistetecni POS - Venta ${normalizeText(sale?.invoiceNumber, '')}`.trim(),
    payment_form: '1',
    payment_method_code: mapPaymentMethodCode(sale?.paymentMethod),
    customer: buildCustomerPayload(sale),
    items: buildInvoiceItems(items),
  };

  return await factusCreateInvoice(cfg, payload);
};

export const factusCreateCreditNote = async (cfg: FactusConfig, payload: any) => {
  return await factusRequest(cfg, '/v1/credit-notes/validate', payload);
};

export const factusCreateDebitNote = async (cfg: FactusConfig, payload: any) => {
  return await factusRequest(cfg, '/v1/debit-notes/validate', payload);
};

export const factusCreateCreditNoteFromSale = async (
  cfg: FactusConfig,
  input: FactusNoteInput,
) => {
  const sale = input.sale;
  const amount = normalizeNumber(input.amount, normalizeNumber(sale?.total, 0));
  const full = (input.mode ?? 'full') === 'full';

  if (!sale?.factus_bill_id) {
    throw new Error('La venta no tiene factus_bill_id para emitir nota crédito.');
  }

  const numberingRangeId = await factusGetNumberingRange(cfg, 22);

  const payload = {
    numbering_range_id: numberingRangeId ?? undefined,
    correction_concept_code: normalizeText(input.reasonCode, '1'),
    customization_id: 20,
    bill_id: Number(sale.factus_bill_id),
    reference_code: `NC-${normalizeText(sale?.invoice_number ?? sale?.invoiceNumber, input.saleId)}-${Date.now()}`,
    payment_method_code: mapPaymentMethodCode(sale?.payment_method ?? sale?.paymentMethod),
    send_email: Boolean(input.sendEmail ?? false),
    observation: normalizeText(input.reasonText, 'Nota crédito generada desde Sistetecni POS'),
    customer: buildCustomerPayload(sale),
    items: full
      ? buildInvoiceItems(Array.isArray(sale?.items) ? sale.items : [])
      : buildSingleAdjustmentItem(
          `Nota crédito parcial ${normalizeText(sale?.invoice_number ?? sale?.invoiceNumber, '')}`.trim(),
          amount,
        ),
  };

  return await factusCreateCreditNote(cfg, payload);
};

export const factusCreateDebitNoteFromSale = async (
  cfg: FactusConfig,
  input: FactusNoteInput,
) => {
  const sale = input.sale;
  const amount = normalizeNumber(input.amount, 0);

  if (!sale?.factus_bill_id) {
    throw new Error('La venta no tiene factus_bill_id para emitir nota débito.');
  }

  if (amount <= 0) {
    throw new Error('El valor de la nota débito debe ser mayor a 0.');
  }

  const numberingRangeId = await factusGetNumberingRange(cfg, 23);

  const payload = {
    numbering_range_id: numberingRangeId ?? undefined,
    correction_concept_code: normalizeText(input.reasonCode, '4'),
    customization_id: 20,
    bill_id: Number(sale.factus_bill_id),
    reference_code: `ND-${normalizeText(sale?.invoice_number ?? sale?.invoiceNumber, input.saleId)}-${Date.now()}`,
    payment_method_code: mapPaymentMethodCode(sale?.payment_method ?? sale?.paymentMethod),
    send_email: Boolean(input.sendEmail ?? false),
    observation: normalizeText(input.reasonText, 'Nota débito generada desde Sistetecni POS'),
    customer: buildCustomerPayload(sale),
    items: buildSingleAdjustmentItem(
      `Nota débito ${normalizeText(sale?.invoice_number ?? sale?.invoiceNumber, '')}`.trim(),
      amount,
    ),
  };

  return await factusCreateDebitNote(cfg, payload);
};

export const buildFactusPersistenceData = (factus: any) => {
  const bill = factus?.data?.bill ?? {};

  return {
    factusStatus: 'OK',
    factusBillId: bill?.id != null ? Number(bill.id) : null,
    factusBillNumber: bill?.number ? String(bill.number) : null,
    factusPublicUrl: bill?.public_url ? String(bill.public_url) : null,
    factusCufe: bill?.cufe ? String(bill.cufe) : null,
    factusValidatedAt: bill?.validated ? String(bill.validated) : null,
    factusError: null,
    factusRawJson: JSON.stringify(factus),
  };
};

export const buildFactusEventPersistenceData = (factus: any) => {
  const note = factus?.data?.credit_note ?? factus?.data?.debit_note ?? factus?.data?.bill ?? {};
  return {
    providerDocumentId: note?.id != null ? Number(note.id) : null,
    providerNumber: note?.number ? String(note.number) : null,
    providerPublicUrl: note?.public_url ? String(note.public_url) : null,
    cufe: note?.cufe ? String(note.cufe) : null,
    validatedAt: note?.validated ? String(note.validated) : null,
    responseJson: JSON.stringify(factus),
  };
};