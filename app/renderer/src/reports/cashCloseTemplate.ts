const money = (n: number): string =>
  `$${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(Number(n || 0))}`;

export const buildCashCloseHtml = (data: {
  businessName: string;
  cashierName: string;
  openedAt: string;
  closedAt: string;
  openingCash: number;
  cashSales: number;
  totalExpenses: number;
  expectedCash: number;
  countedCash: number;
  diff: number;
}) => {
  return `
  <!doctype html>
  <html lang="es">
    <head>
      <meta charset="utf-8" />
      <title>Cierre de caja</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          padding: 24px;
          color: #111;
        }
        h1, h2, h3, p {
          margin: 0 0 10px 0;
        }
        .header {
          margin-bottom: 24px;
          border-bottom: 2px solid #ddd;
          padding-bottom: 12px;
        }
        .muted {
          color: #666;
          font-size: 13px;
        }
        .box {
          border: 1px solid #ddd;
          border-radius: 10px;
          padding: 14px;
          margin-bottom: 14px;
        }
        .row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        .label {
          font-weight: bold;
        }
        .total {
          font-size: 18px;
          font-weight: bold;
        }
        .ok {
          color: #0a7a2f;
        }
        .bad {
          color: #b42318;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${data.businessName}</h1>
        <h2>Comprobante de cierre de caja</h2>
        <p class="muted">Cajero: ${data.cashierName}</p>
        <p class="muted">Apertura: ${data.openedAt}</p>
        <p class="muted">Cierre: ${data.closedAt}</p>
      </div>

      <div class="box">
        <div class="row"><span class="label">Inicio de caja</span><span>${money(data.openingCash)}</span></div>
        <div class="row"><span class="label">Ventas en efectivo</span><span>${money(data.cashSales)}</span></div>
        <div class="row"><span class="label">Gastos</span><span>${money(data.totalExpenses)}</span></div>
        <div class="row total"><span>Efectivo esperado</span><span>${money(data.expectedCash)}</span></div>
      </div>

      <div class="box">
        <div class="row"><span class="label">Efectivo contado</span><span>${money(data.countedCash)}</span></div>
        <div class="row total">
          <span>Diferencia</span>
          <span class="${Number(data.diff) < 0 ? 'bad' : 'ok'}">${money(data.diff)}</span>
        </div>
      </div>
    </body>
  </html>
  `;
};