// src/pages/DailyClose.tsx
import { useEffect, useMemo, useState } from 'react';
import { reportDailyClose } from '../services/reports';
import { printInvoice } from '../services/sales';
import { buildDailyCloseHtml } from '../reports/dailyCloseTemplate';
import { getConfig } from '../services/config';

const money = (n: number): string => {
  const v = Number(n || 0);
  const formatted = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(v);
  return `$${formatted}`;
};

const pad = (n: number) => String(n).padStart(2, '0');
const localYmd = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const DailyClose = ({ user }: { user: any }) => {
  const [date, setDate] = useState(localYmd(new Date()));
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [bizName, setBizName] = useState('');

  const from = useMemo(() => date, [date]);
  const to = useMemo(() => date, [date]); // por ahora cierre por día

  const load = async () => {
    setLoading(true);
    try {
      const res = await reportDailyClose(from, to);
      setData(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  useEffect(() => {
    (async () => {
      try {
        const cfg = await getConfig();
        setBizName(cfg?.business?.name ?? '');
      } catch {
        setBizName('');
      }
    })();
  }, []);

  const totalsByMethod: Record<string, number> = data?.totalsByMethod ?? {};
  const totalSales = Number(data?.totalSales ?? 0);
  const profit = Number(data?.profit ?? 0);
  const totalExpenses = Number(data?.totalExpenses ?? 0);
  const net = Number(data?.net ?? profit - totalExpenses);

  const onExport = async () => {
    const html = buildDailyCloseHtml({
      businessName: bizName || 'Sistetecni POS',
      from,
      to,
      cashierName: user?.name || user?.email || '',
      totalSales,
      profit,
      totalExpenses,
      net,
      totalsByMethod,
    });

    await printInvoice(html); // abre impresión -> Guardar como PDF si no hay impresora
  };

  return (
    <div className="card">
      <div className="topbar" style={{ position: 'static', marginBottom: 12 }}>
        <div>
          <div className="topbar__title">Cierre diario</div>
          <div className="topbar__subtitle">Ventas, gastos y neto del día</div>
        </div>

        <div className="topbar__right">
          <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ opacity: 0.8, fontWeight: 800 }}>Fecha:</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>

          <button className="btn" onClick={load} disabled={loading}>
            {loading ? 'Cargando...' : 'Refrescar'}
          </button>

          <button className="btn" onClick={onExport} disabled={loading}>
            Exportar PDF
          </button>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div style={{ opacity: 0.8, fontWeight: 900 }}>Total ventas</div>
          <div style={{ fontSize: 28, fontWeight: 1000, marginTop: 8 }}>{money(totalSales)}</div>
        </div>

        <div className="card">
          <div style={{ opacity: 0.8, fontWeight: 900 }}>Utilidad</div>
          <div style={{ fontSize: 28, fontWeight: 1000, marginTop: 8 }}>{money(profit)}</div>
        </div>

        <div className="card">
          <div style={{ opacity: 0.8, fontWeight: 900 }}>Gastos</div>
          <div style={{ fontSize: 28, fontWeight: 1000, marginTop: 8 }}>{money(totalExpenses)}</div>
        </div>

        <div className="card">
          <div style={{ opacity: 0.8, fontWeight: 900 }}>Neto</div>
          <div style={{ fontSize: 28, fontWeight: 1000, marginTop: 8 }}>{money(net)}</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 1000, marginBottom: 10 }}>Totales por método</div>

        <table>
          <thead>
            <tr>
              <th>Método</th>
              <th style={{ textAlign: 'right' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(totalsByMethod).length ? (
              Object.entries(totalsByMethod)
                .sort((a, b) => Number(b[1]) - Number(a[1]))
                .map(([k, v]) => (
                  <tr key={k}>
                    <td>{k}</td>
                    <td style={{ textAlign: 'right', fontWeight: 900 }}>{money(Number(v || 0))}</td>
                  </tr>
                ))
            ) : (
              <tr>
                <td colSpan={2} style={{ opacity: 0.8 }}>
                  Sin ventas en este día.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};