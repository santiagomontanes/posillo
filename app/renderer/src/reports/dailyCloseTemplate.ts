// src/reports/dailyCloseTemplate.ts
const money = (n: number): string => {
  const v = Number(n || 0);
  const formatted = new Intl.NumberFormat('es-CO', {
    maximumFractionDigits: 0,
  }).format(v);
  return `$${formatted}`;
};

const dmy = (ymd: string): string => {
  const s = String(ymd ?? '').slice(0, 10);
  const [y, m, d] = s.split('-');
  if (!y || !m || !d) return s;
  return `${d}/${m}/${y}`;
};

export const buildDailyCloseHtml = (data: {
  businessName?: string;
  from: string;
  to: string;
  cashierName?: string;

  totalSales: number;
  totalReturns?: number;
  netSales?: number;

  profit: number;
  totalExpenses: number;
  net: number;

  totalsByMethod: Record<string, number>;
}) => {
  const methods = Object.entries(data.totalsByMethod ?? {}).sort(
    (a, b) => Number(b[1]) - Number(a[1]),
  );

  const totalSales = Number(data.totalSales ?? 0);
  const totalReturns = Number(data.totalReturns ?? 0);
  const netSales = Number(data.netSales ?? (totalSales - totalReturns));
  const profit = Number(data.profit ?? 0);
  const totalExpenses = Number(data.totalExpenses ?? 0);
  const net = Number(data.net ?? 0);

  return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Cierre diario</title>
  <style>
    *{ box-sizing:border-box; }
    body{
      font-family: Arial, sans-serif;
      margin: 24px;
      color:#0b1220;
      background:#ffffff;
    }

    .header{
      border-bottom: 2px solid #e9eef6;
      padding-bottom: 12px;
      margin-bottom: 18px;
    }

    .brand{
      font-weight: 900;
      font-size: 22px;
      color:#0f172a;
    }

    .subtitle{
      color:#667085;
      font-size: 12px;
      margin-top:6px;
      line-height:1.5;
    }

    .section-title{
      font-weight: 900;
      font-size: 14px;
      margin-bottom: 10px;
      color:#0f172a;
    }

    .grid{
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-top: 12px;
    }

    .card{
      border:1px solid #e6e8ee;
      border-radius:12px;
      padding:14px;
      background:#fff;
    }

    .label{
      color:#667085;
      font-size:12px;
      font-weight:700;
      text-transform: uppercase;
      letter-spacing:.4px;
    }

    .value{
      font-size:22px;
      font-weight:900;
      margin-top:8px;
      color:#101828;
    }

    .value.negative{
      color:#b42318;
    }

    .value.positive{
      color:#067647;
    }

    table{
      width:100%;
      border-collapse: collapse;
      margin-top:10px;
    }

    th, td{
      text-align:left;
      padding:10px 8px;
      border-bottom:1px solid #eef1f6;
      font-size:13px;
    }

    th{
      color:#667085;
      font-size:12px;
      text-transform:uppercase;
      letter-spacing:.6px;
    }

    .right{
      text-align:right;
    }

    .summary{
      margin-top: 18px;
      border:1px solid #e6e8ee;
      border-radius:12px;
      padding:14px;
    }

    .summary-row{
      display:flex;
      justify-content:space-between;
      gap:16px;
      padding:8px 0;
      border-bottom:1px solid #eef1f6;
      font-size:14px;
    }

    .summary-row:last-child{
      border-bottom:none;
    }

    .summary-row.total{
      font-weight:900;
      font-size:16px;
      padding-top:12px;
    }

    .footer{
      margin-top:20px;
      font-size:11px;
      color:#667085;
      text-align:center;
    }

    @media print {
      body{ margin: 14px; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">${data.businessName || 'Sistetecni POS'}</div>
    <div class="subtitle">
      Cierre diario: <b>${dmy(data.from)}</b>${data.to !== data.from ? ` → <b>${dmy(data.to)}</b>` : ''}
      ${data.cashierName ? ` | Operador: <b>${data.cashierName}</b>` : ''}
    </div>
  </div>

  <div class="grid">
    <div class="card">
      <div class="label">Ventas brutas</div>
      <div class="value">${money(totalSales)}</div>
    </div>

    <div class="card">
      <div class="label">Devoluciones</div>
      <div class="value negative">${money(totalReturns)}</div>
    </div>

    <div class="card">
      <div class="label">Ventas netas</div>
      <div class="value">${money(netSales)}</div>
    </div>

    <div class="card">
      <div class="label">Utilidad</div>
      <div class="value">${money(profit)}</div>
    </div>

    <div class="card">
      <div class="label">Gastos</div>
      <div class="value negative">${money(totalExpenses)}</div>
    </div>

    <div class="card">
      <div class="label">Neto final</div>
      <div class="value ${net >= 0 ? 'positive' : 'negative'}">${money(net)}</div>
    </div>
  </div>

  <div class="card" style="margin-top:16px;">
    <div class="section-title">Totales por método de pago</div>
    <table>
      <thead>
        <tr>
          <th>Método</th>
          <th class="right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${
          methods.length
            ? methods
                .map(
                  ([k, v]) => `
                    <tr>
                      <td>${k}</td>
                      <td class="right">${money(Number(v || 0))}</td>
                    </tr>
                  `,
                )
                .join('')
            : `
              <tr>
                <td colspan="2">Sin ventas en el rango.</td>
              </tr>
            `
        }
      </tbody>
    </table>
  </div>

  <div class="summary">
    <div class="section-title">Resumen del cierre</div>

    <div class="summary-row">
      <span>Ventas brutas</span>
      <strong>${money(totalSales)}</strong>
    </div>

    <div class="summary-row">
      <span>Menos devoluciones</span>
      <strong>${money(totalReturns)}</strong>
    </div>

    <div class="summary-row">
      <span>Ventas netas</span>
      <strong>${money(netSales)}</strong>
    </div>

    <div class="summary-row">
      <span>Menos gastos</span>
      <strong>${money(totalExpenses)}</strong>
    </div>

    <div class="summary-row total">
      <span>Resultado final</span>
      <span>${money(net)}</span>
    </div>
  </div>

  <div class="footer">
    Generado por Sistetecni POS.
  </div>
</body>
</html>
  `.trim();
};