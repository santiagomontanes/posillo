import { useEffect, useMemo, useState } from 'react';
import { reportDailyClose } from '../services/reports';
import { printInvoice } from '../services/sales';
import { buildDailyCloseHtml } from '../reports/dailyCloseTemplate';
import { getConfig } from '../services/config';

const money = (n: number): string => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number(n || 0));
};

const pad = (n: number) => String(n).padStart(2, '0');
const localYmd = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const DailyClose = ({ user }: { user: any }) => {
  const [date, setDate] = useState(localYmd(new Date()));
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [bizName, setBizName] = useState('');
  const [error, setError] = useState('');

  const from = useMemo(() => date, [date]);
  const to = useMemo(() => date, [date]);

  const load = async () => {
    setLoading(true);
    setError('');

    try {
      const res = await reportDailyClose(from, to);
      setData(res);
    } catch (e: any) {
      setError(e?.message || 'No se pudo cargar el cierre diario.');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
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
  const totalReturns = Number(data?.totalReturns ?? 0);
  const netSales = Number(data?.netSales ?? (totalSales - totalReturns));

  const profit = Number(data?.profit ?? 0);
  const totalExpenses = Number(data?.totalExpenses ?? 0);

  const net = Number(data?.net ?? netSales - totalExpenses);

const onExport = async () => {
  const html = buildDailyCloseHtml({
    businessName: bizName || 'Sistetecni POS',
    from,
    to,
    cashierName: user?.name || user?.email || '',
    totalSales,
    totalReturns,
    netSales,
    profit,
    totalExpenses,
    net,
    totalsByMethod,
  });

  await printInvoice(html);
};

  return (
    <div className="dashboard">
      <div className="card dashboard__hero">
        <div>
          <div className="dashboard__eyebrow">Cierre diario</div>
          <h2 className="dashboard__title">Resumen consolidado del día</h2>
          <p className="dashboard__text">
            Consulta ventas, devoluciones, utilidad, gastos y neto del día.
          </p>
        </div>
      </div>

      <div className="card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'end',
            gap: 14,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div className="dashboard__section-title">Seleccionar fecha</div>
            <div className="dashboard__cash-value">
              Genera el cierre detallado por día.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ opacity: 0.8, fontWeight: 800 }}>Fecha:</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>

            <button className="btn btn--ghost" onClick={load} disabled={loading}>
              {loading ? 'Cargando...' : 'Refrescar'}
            </button>

            <button className="btn" onClick={onExport} disabled={loading}>
              Exportar PDF
            </button>
          </div>
        </div>

        {error ? (
          <div className="pos__msg" style={{ marginTop: 14 }}>
            {error}
          </div>
        ) : null}
      </div>

      <div className="grid grid-2 dashboard__stats">

        <div className="card stat-card">
          <div className="stat-card__label">Ventas brutas</div>
          <div className="stat-card__value">{money(totalSales)}</div>
        </div>

        <div className="card stat-card">
          <div className="stat-card__label">Devoluciones</div>
          <div className="stat-card__value">{money(totalReturns)}</div>
        </div>

        <div className="card stat-card">
          <div className="stat-card__label">Ventas netas</div>
          <div className="stat-card__value">{money(netSales)}</div>
        </div>

        <div className="card stat-card">
          <div className="stat-card__label">Utilidad</div>
          <div className="stat-card__value">{money(profit)}</div>
        </div>

        <div className="card stat-card">
          <div className="stat-card__label">Gastos</div>
          <div className="stat-card__value">{money(totalExpenses)}</div>
        </div>

        <div className="card stat-card">
          <div className="stat-card__label">Neto</div>
          <div className="stat-card__value">{money(net)}</div>
        </div>

      </div>

      <div className="card">
        <div className="dashboard__section-title">Totales por método de pago</div>

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
                    <td style={{ textAlign: 'right', fontWeight: 900 }}>
                      {money(Number(v || 0))}
                    </td>
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