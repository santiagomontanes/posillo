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
  businessName?: string;
  businessLogoDataUrl?: string;
  businessNit?: string;
  businessPhone?: string;
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
  const businessNit = safe(data.businessNit || '');
  const businessPhone = safe(data.businessPhone || '');
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
          <div class="name">${name}</div>
          ${desc ? `<div class="muted desc">${desc}</div>` : ''}
          <div class="row">
            <div>${qty} x ${unit}</div>
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
    @page {
      size: 58mm auto;
      margin: 0;
    }

    * {
      box-sizing: border-box;
    }

    html, body {
      margin: 0;
      padding: 0;
      width: 58mm;
      background: #fff;
      color: #000;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12px;
      line-height: 1.25;
    }

    body {
      padding: 3mm;
    }

    .ticket {
      width: 100%;
    }

    .center {
      text-align: center;
    }

    .right {
      text-align: right;
      white-space: nowrap;
    }

    .row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 8px;
    }

    .muted {
      font-size: 11px;
      opacity: 0.8;
    }

    .title {
      font-weight: 900;
      font-size: 15px;
    }

    .big {
      font-weight: 900;
      font-size: 16px;
    }

    .hr {
      border-top: 1px dashed #000;
      margin: 6px 0;
    }

    .item {
      padding: 5px 0;
    }

    .name {
      font-weight: 700;
      word-break: break-word;
    }

    .desc {
      margin-top: 2px;
      word-break: break-word;
    }

    .totals .row {
      padding: 2px 0;
    }

    .total-row {
      border-top: 1px dashed #000;
      margin-top: 6px;
      padding-top: 6px;
    }

    .logoWrap {
      display: flex;
      justify-content: center;
      margin-bottom: 6px;
    }

    .logo {
      max-width: 160px;
      max-height: 60px;
      object-fit: contain;
    }

    .spacer {
      height: 12px;
    }
  </style>
</head>
<body>
  <div class="ticket">
    ${logo ? `<div class="logoWrap"><img class="logo" src="${logo}" alt="logo" /></div>` : ''}

    ${businessName ? `<div class="center title">${businessName}</div>` : ''}
    ${businessNit ? `<div class="center muted">NIT: ${businessNit}</div>` : ''}
    ${businessPhone ? `<div class="center muted">Cel: ${businessPhone}</div>` : ''}
    <div class="center muted">Powered by <b>Sistetecni POS</b></div>

    <div class="hr"></div>

    <div><b>Factura:</b> ${safe(data.invoiceNumber)}</div>
    <div><b>Fecha:</b> ${safe(dateText)}</div>
    <div><b>Cajero:</b> ${safe(data.cashierName || '—')}</div>
    <div><b>Método:</b> ${safe(data.paymentMethod || '—')}</div>

    <div class="hr"></div>

    <div><b>Cliente:</b> ${safe(data.customerName || 'Consumidor final')}</div>
    <div><b>Doc:</b> ${safe(data.customerId || '—')}</div>

    <div class="hr"></div>

    ${itemLines || `<div class="muted">Sin ítems</div>`}

    <div class="hr"></div>

    <div class="totals">
      <div class="row">
        <div>Subtotal</div>
        <div class="right"><b>${money(data.subtotal)}</b></div>
      </div>

      <div class="row">
        <div>Descuento</div>
        <div class="right"><b>${money(data.discount)}</b></div>
      </div>

      ${showCash ? `
        <div class="row">
          <div>Recibido</div>
          <div class="right"><b>${money(received)}</b></div>
        </div>
        <div class="row">
          <div>Cambio</div>
          <div class="right"><b>${money(change)}</b></div>
        </div>
      ` : ''}

      <div class="row total-row">
        <div class="big">TOTAL</div>
        <div class="right big">${money(data.total)}</div>
      </div>
    </div>

    <div class="hr"></div>

    <div class="center">Gracias por tu compra</div>
    <div class="center muted">Generado por Sistetecni POS</div>

    <div class="spacer"></div>
  </div>
</body>
</html>`;
};