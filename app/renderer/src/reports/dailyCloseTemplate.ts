// src/reports/dailyCloseTemplate.ts
const money = (n: number): string => {
  const v = Number(n || 0);
  const formatted = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(v);
  return `$${formatted}`;
};

const dmy = (ymd: string): string => {
  // "YYYY-MM-DD" => "DD/MM/YYYY"
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
  profit: number;
  totalExpenses: number;
  net: number;
  totalsByMethod: Record<string, number>;
}) => {
  const methods = Object.entries(data.totalsByMethod ?? {}).sort((a, b) => b[1] - a[1]);

  return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Cierre diario</title>
  <style>
    body{ font-family: Arial, sans-serif; margin: 24px; color:#0b1220; }
    .brand{ font-weight: 900; font-size: 18px; }
    .muted{ color:#667085; font-size: 12px; margin-top:4px; }
    .row{ display:flex; justify-content:space-between; gap:16px; }
    .card{ border:1px solid #e6e8ee; border-radius:12px; padding:14px; margin-top:12px; }
    .kpi{ flex:1; }
    .kpi .label{ color:#667085; font-size:12px; font-weight:700; }
    .kpi .value{ font-size:22px; font-weight:900; margin-top:6px; }
    table{ width:100%; border-collapse: collapse; margin-top:10px; }
    th,td{ text-align:left; padding:10px 8px; border-bottom:1px solid #eef1f6; font-size:13px; }
    th{ color:#667085; font-size:12px; text-transform:uppercase; letter-spacing:.6px; }
    .right{text-align:right;}
    .net{ font-weight: 900; }
    .footer{ margin-top:18px; font-size:11px; color:#667085; }
  </style>
</head>
<body>
  <div class="brand">${data.businessName || 'Sistetecni POS'}</div>
  <div class="muted">
    Cierre diario: <b>${dmy(data.from)}</b>${data.to !== data.from ? ` → <b>${dmy(data.to)}</b>` : ''}
    ${data.cashierName ? ` | Operador: <b>${data.cashierName}</b>` : ''}
  </div>

  <div class="row">
    <div class="card kpi">
      <div class="label">Total ventas</div>
      <div class="value">${money(data.totalSales)}</div>
    </div>
    <div class="card kpi">
      <div class="label">Utilidad</div>
      <div class="value">${money(data.profit)}</div>
    </div>
    <div class="card kpi">
      <div class="label">Gastos</div>
      <div class="value">${money(data.totalExpenses)}</div>
    </div>
    <div class="card kpi">
      <div class="label">Neto</div>
      <div class="value net">${money(data.net)}</div>
    </div>
  </div>

  <div class="card">
    <div style="font-weight:900; margin-bottom:8px;">Totales por método</div>
    <table>
      <thead>
        <tr><th>Método</th><th class="right">Total</th></tr>
      </thead>
      <tbody>
        ${
          methods.length
            ? methods
                .map(
                  ([k, v]) => `<tr><td>${k}</td><td class="right">${money(Number(v || 0))}</td></tr>`,
                )
                .join('')
            : `<tr><td colspan="2">Sin ventas en el rango.</td></tr>`
        }
      </tbody>
    </table>
  </div>

  <div class="footer">
    Generado por Sistetecni POS.
  </div>
</body>
</html>
  `.trim();
};