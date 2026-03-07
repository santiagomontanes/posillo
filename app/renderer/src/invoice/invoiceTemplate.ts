// invoiceTemplate.ts (58mm térmica)
const money = (n: any): string => {
  const v = Number(n ?? 0);
  const safeNum = Number.isFinite(v) ? v : 0;
  return `$${Math.round(safeNum).toLocaleString('es-CO')}`;
};

const safe = (v: any): string =>
  String(v ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

export type InvoiceItem = {
  name: string;
  description?: string;
  qty: number;
  unit_price: number;
  line_total: number;
};

export type InvoiceData = {
  invoiceNumber: string;
  createdAt?: string;
  cashierName?: string;
  paymentMethod?: string;

  customerName?: string;
  customerId?: string;

  subtotal: number;
  discount: number;
  total: number;

  items: InvoiceItem[];

  cashReceived?: number;
  cashChange?: number;

  // ✅ NUEVO: negocio
  businessName?: string;
  businessLogoDataUrl?: string;
};

export const buildInvoiceHtml = (data: InvoiceData): string => {
  const dateText = data.createdAt
    ? new Date(data.createdAt).toLocaleString('es-CO')
    : new Date().toLocaleString('es-CO');

  const items = data.items ?? [];

  const received = Number(data.cashReceived ?? 0);
  const change = Number(data.cashChange ?? 0);
  const showCash = received > 0 || change > 0;

  const businessName = safe(data.businessName || '');
  const logo = String(data.businessLogoDataUrl || '');

  const itemLines = items
    .map((it) => {
      const name = safe(it.name);
      const desc = it.description ? safe(it.description) : '';
      const qty = Number(it.qty ?? 0);
      const unit = money(it.unit_price);
      const total = money(it.line_total);

      return `
        <div class="item">
          <div class="row">
            <div class="left bold">${name}</div>
          </div>
          ${desc ? `<div class="muted">${desc}</div>` : ''}
          <div class="row">
            <div class="left">${qty} x ${unit}</div>
            <div class="right">${total}</div>
          </div>
        </div>
      `;
    })
    .join('');

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Factura ${safe(data.invoiceNumber)}</title>

  <style>
    * { box-sizing: border-box; }
    body { margin:0; padding:0; background:#fff; color:#000; font-family: Arial, Helvetica, sans-serif; }

    .ticket{
      width: 384px;
      padding: 10px 10px 18px;
      margin: 0 auto;
      font-size: 12px;
      line-height: 1.25;
    }

    .center{ text-align:center; }
    .right{ text-align:right; white-space:nowrap; }
    .row{ display:flex; justify-content:space-between; gap:10px; }
    .left{ flex:1; }

    .muted{ opacity:.75; font-size:11px; }
    .bold{ font-weight:800; }
    .title{ font-weight:900; font-size:14px; }
    .big{ font-weight:900; font-size:16px; }

    .hr{ border-top: 1px dashed #000; margin: 8px 0; }
    .item{ padding: 6px 0; }

    .totals{ margin-top: 6px; }
    .totals .row{ padding: 3px 0; }
    .totals .total{
      margin-top: 6px;
      padding-top: 6px;
      border-top: 1px dashed #000;
    }

    .logoWrap{ display:flex; justify-content:center; margin-bottom: 6px; }
    .logo{ max-width: 180px; max-height: 70px; object-fit: contain; }

    @media print {
      body{ margin:0; }
      .ticket{ width:100%; }
    }
  </style>
</head>

<body>
  <div class="ticket">
    ${logo ? `<div class="logoWrap"><img class="logo" src="${logo}" alt="logo" /></div>` : ''}

    ${businessName ? `<div class="center title">${businessName}</div>` : ''}

    <div class="center muted">Powered by <b>Sistetecni POS</b></div>

    <div class="hr"></div>

    <div class="row"><div class="left"><span class="bold">Factura:</span> ${safe(data.invoiceNumber)}</div></div>
    <div class="row"><div class="left"><span class="bold">Fecha:</span> ${safe(dateText)}</div></div>
    <div class="row"><div class="left"><span class="bold">Cajero:</span> ${safe(data.cashierName || '—')}</div></div>
    <div class="row"><div class="left"><span class="bold">Método:</span> ${safe(data.paymentMethod || '—')}</div></div>

    <div class="hr"></div>

    <div class="row"><div class="left"><span class="bold">Cliente:</span> ${safe(data.customerName || 'Consumidor final')}</div></div>
    <div class="row"><div class="left"><span class="bold">Doc:</span> ${safe(data.customerId || '—')}</div></div>

    <div class="hr"></div>

    ${itemLines || `<div class="muted">Sin ítems</div>`}

    <div class="hr"></div>

    <div class="totals">
      <div class="row"><div class="left">Subtotal</div><div class="right bold">${money(data.subtotal)}</div></div>
      <div class="row"><div class="left">Descuento</div><div class="right bold">${money(data.discount)}</div></div>

      ${showCash ? `
        <div class="row"><div class="left">Recibido</div><div class="right bold">${money(received)}</div></div>
        <div class="row"><div class="left">Cambio</div><div class="right bold">${money(change)}</div></div>
      ` : ''}

      <div class="row total">
        <div class="left big">TOTAL</div>
        <div class="right big">${money(data.total)}</div>
      </div>
    </div>

    <div class="hr"></div>

    <div class="center">Gracias por tu compra</div>
    <div class="center muted">Generado por Sistetecni POS</div>

    <div style="height: 14px;"></div>
  </div>
</body>
</html>`;
};