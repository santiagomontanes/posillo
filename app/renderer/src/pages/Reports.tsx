import { useEffect, useMemo, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { CategoryScale, Chart as ChartJS, LinearScale, BarElement } from 'chart.js';
import { salesByDay, summary, topProducts } from '../services/reports';

ChartJS.register(CategoryScale, LinearScale, BarElement);

const asArray = (v: any): any[] => {
  if (Array.isArray(v)) return v;
  if (Array.isArray(v?.rows)) return v.rows;
  if (Array.isArray(v?.data)) return v.data;
  if (Array.isArray(v?.result)) return v.result;
  if (Array.isArray(v?.items)) return v.items;
  return [];
};

const asObject = (v: any): any => {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    if (v.data && typeof v.data === 'object') return v.data;
    if (v.row && typeof v.row === 'object') return v.row;
    if (v.result && typeof v.result === 'object') return v.result;
    return v;
  }
  return {};
};

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

const money = (n: number): string =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number(n || 0));

export const Reports = () => {
  const [data, setData] = useState<any[]>([]);
  const [top, setTop] = useState<any[]>([]);
  const [sum, setSum] = useState<any>({
    total_sales: 0,
    total_costs: 0,
    total_expenses: 0,
    utility: 0,
  });
  const [error, setError] = useState('');

  const from = useMemo(() => isoDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)), []);
  const to = useMemo(() => isoDate(new Date()), []);

  useEffect(() => {
    void (async () => {
      setError('');
      try {
        const [dRaw, tRaw, sRaw] = await Promise.all([
          salesByDay(from, to),
          topProducts(from, to),
          summary(from, to),
        ]);

        const d = asArray(dRaw);
        const t = asArray(tRaw);
        const s = asObject(sRaw);

        const totalSales = Number(s.total_sales ?? s.total ?? 0);
        const totalCosts = Number(s.total_costs ?? s.costs ?? 0);
        const totalExpenses = Number(s.total_expenses ?? s.expenses ?? 0);

        setData(d);
        setTop(t);
        setSum({
          ...s,
          total_sales: totalSales,
          total_costs: totalCosts,
          total_expenses: totalExpenses,
          utility: totalSales - totalCosts - totalExpenses,
        });
      } catch (e: any) {
        setError(e?.message || 'No se pudieron cargar los reportes');
        setData([]);
        setTop([]);
        setSum({ total_sales: 0, total_costs: 0, total_expenses: 0, utility: 0 });
      }
    })();
  }, [from, to]);

  const labels = useMemo(
    () => asArray(data).map((d: any) => String(d?.day ?? d?.date ?? '')),
    [data],
  );

  const totals = useMemo(
    () => asArray(data).map((d: any) => Number(d?.total ?? d?.total_sales ?? 0)),
    [data],
  );

  return (
    <div className="dashboard">
      <div className="card dashboard__hero">
        <div>
          <div className="dashboard__eyebrow">Reportes</div>
          <h2 className="dashboard__title">Análisis de ventas y rendimiento</h2>
          <p className="dashboard__text">
            Consulta el comportamiento comercial del negocio y detecta tendencias de ventas.
          </p>
        </div>
      </div>

      {error && <div className="card">Error: {error}</div>}

      <div className="grid grid-2 dashboard__stats">
        <div className="card stat-card">
          <div className="stat-card__label">Ventas del período</div>
          <div className="stat-card__value">{money(sum.total_sales ?? 0)}</div>
        </div>

        <div className="card stat-card">
          <div className="stat-card__label">Gastos del período</div>
          <div className="stat-card__value">{money(sum.total_expenses ?? 0)}</div>
        </div>

        <div className="card stat-card">
          <div className="stat-card__label">Costos del período</div>
          <div className="stat-card__value">{money(sum.total_costs ?? 0)}</div>
        </div>

        <div className="card stat-card">
          <div className="stat-card__label">Utilidad estimada</div>
          <div className="stat-card__value">{money(sum.utility ?? 0)}</div>
        </div>
      </div>

      <div className="card dashboard__chart-card">
        <div className="dashboard__section-title">Ventas por día</div>
        <Bar
          data={{
            labels,
            datasets: [{ label: 'Ventas', data: totals }],
          }}
          options={{
            responsive: true,
            plugins: {
              legend: {
                labels: {
                  color: '#e8eefc',
                },
              },
            },
            scales: {
              x: {
                ticks: { color: '#a9b6d6' },
                grid: { color: 'rgba(255,255,255,.05)' },
              },
              y: {
                ticks: { color: '#a9b6d6' },
                grid: { color: 'rgba(255,255,255,.05)' },
              },
            },
          }}
        />
      </div>

      <div className="card">
        <div className="dashboard__section-title">Top productos</div>

        {asArray(top).length === 0 && <div style={{ opacity: 0.8 }}>Sin datos.</div>}

        <div style={{ display: 'grid', gap: 10 }}>
          {asArray(top).map((t: any, i: number) => (
            <div
              key={String(t?.name ?? i)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                padding: '12px 14px',
                borderRadius: 14,
                background: 'rgba(255,255,255,.03)',
                border: '1px solid rgba(255,255,255,.06)',
              }}
            >
              <span style={{ fontWeight: 700 }}>{String(t?.name ?? '')}</span>
              <span style={{ color: 'var(--muted)' }}>{Number(t?.qty ?? 0)} vendidos</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};