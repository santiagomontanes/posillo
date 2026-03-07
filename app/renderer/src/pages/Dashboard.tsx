import { useEffect, useMemo, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { CategoryScale, Chart as ChartJS, LinearScale, BarElement } from 'chart.js';
import { last7DaysSales, todaySummary } from '../services/reports';
import { ipc } from '../services/ipcClient';
import { getAuthContext } from '../services/session';

ChartJS.register(CategoryScale, LinearScale, BarElement);

const asArray = (v: any): any[] => {
  if (Array.isArray(v)) return v;
  if (Array.isArray(v?.rows)) return v.rows;
  if (Array.isArray(v?.data)) return v.data;
  if (Array.isArray(v?.result)) return v.result;
  if (Array.isArray(v?.items)) return v.items;
  if (Array.isArray(v?.payload)) return v.payload;
  if (Array.isArray(v?.value)) return v.value;
  if (Array.isArray(v?.ok?.data)) return v.ok.data;
  if (Array.isArray(v?.ok?.rows)) return v.ok.rows;
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

const money = (n: number): string => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number(n || 0));
};

export const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [today, setToday] = useState<any>({
    total_sales: 0,
    cash_sales: 0,
    total_expenses: 0,
    total_costs: 0,
  });

  const [cashStatus, setCashStatus] = useState<any>(null);
  const [sales7, setSales7] = useState<any[]>([]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const [tRaw, s7Raw, cash] = await Promise.all([
          todaySummary(),
          last7DaysSales(),
          ipc.cash.getStatus(getAuthContext()),
        ]);

        const t = asObject(tRaw);
        setToday({
          total_sales: Number(t.total_sales ?? t.total ?? 0),
          cash_sales: Number(t.cash_sales ?? t.cash ?? 0),
          total_expenses: Number(t.total_expenses ?? t.expenses ?? 0),
          total_costs: Number(t.total_costs ?? t.costs ?? 0),
        });

        setSales7(asArray(s7Raw));
        setCashStatus(cash);
      } catch (e: any) {
        setError(e?.message || 'No se pudo cargar el dashboard');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const sales7Arr = useMemo(() => asArray(sales7), [sales7]);

  const utility =
    (today.total_sales || 0) - (today.total_costs || 0) - (today.total_expenses || 0);

  const chartLabels = useMemo(
    () =>
      sales7Arr
        .map((d: any) => String(d?.day ?? d?.date ?? d?.label ?? ''))
        .filter(Boolean),
    [sales7Arr],
  );

  const chartData = useMemo(
    () => sales7Arr.map((d: any) => Number(d?.total ?? d?.total_sales ?? 0)),
    [sales7Arr],
  );

  if (loading) return <div className="card">Cargando dashboard...</div>;
  if (error) return <div className="card">Error: {error}</div>;

  return (
    <div className="dashboard">
      <div className="dashboard__hero card">
        <div>
          <div className="dashboard__eyebrow">Resumen general</div>
          <h2 className="dashboard__title">Panel principal del sistema</h2>
          <p className="dashboard__text">
            Consulta rápidamente ventas, gastos, utilidad y estado actual de caja.
          </p>
        </div>
      </div>

      <div className="grid grid-2 dashboard__stats">
        <div className="card stat-card">
          <div className="stat-card__label">Ventas hoy</div>
          <div className="stat-card__value">{money(today.total_sales || 0)}</div>
        </div>

        <div className="card stat-card">
          <div className="stat-card__label">Ventas en efectivo hoy</div>
          <div className="stat-card__value">{money(today.cash_sales || 0)}</div>
        </div>

        <div className="card stat-card">
          <div className="stat-card__label">Gastos hoy</div>
          <div className="stat-card__value">{money(today.total_expenses || 0)}</div>
        </div>

        <div className="card stat-card">
          <div className="stat-card__label">Utilidad estimada hoy</div>
          <div className="stat-card__value">{money(utility || 0)}</div>
        </div>
      </div>

      {cashStatus && (
        <div className="card dashboard__cash-card">
          <div className="dashboard__section-title">Caja abierta (turno actual)</div>
          <div className="dashboard__cash-value">
            Efectivo esperado actual: <strong>{money(cashStatus.expectedCash || 0)}</strong>
          </div>
        </div>
      )}

      <div className="card dashboard__chart-card">
        <div className="dashboard__section-title">Ventas por día (últimos 7 días)</div>
        <Bar
          data={{
            labels: chartLabels,
            datasets: [
              {
                label: 'Ventas',
                data: chartData,
              },
            ],
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
                ticks: {
                  color: '#a9b6d6',
                },
                grid: {
                  color: 'rgba(255,255,255,.05)',
                },
              },
              y: {
                ticks: {
                  color: '#a9b6d6',
                },
                grid: {
                  color: 'rgba(255,255,255,.05)',
                },
              },
            },
          }}
        />
      </div>
    </div>
  );
};