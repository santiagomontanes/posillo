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
  // Para endpoints que deben devolver "un objeto"
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    if (v.data && typeof v.data === 'object') return v.data;
    if (v.row && typeof v.row === 'object') return v.row;
    if (v.result && typeof v.result === 'object') return v.result;
    return v;
  }
  return {};
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

  // ✅ ultra-seguro por si alguien vuelve a setear mal el estado
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
    <div>
      <div className="grid grid-2">
        <div className="card">
          <h3>Ventas hoy</h3>
          <p>{today.total_sales || 0}</p>
        </div>
        <div className="card">
          <h3>Ventas en efectivo hoy</h3>
          <p>{today.cash_sales || 0}</p>
        </div>
        <div className="card">
          <h3>Gastos hoy</h3>
          <p>{today.total_expenses || 0}</p>
        </div>
        <div className="card">
          <h3>Utilidad estimada hoy</h3>
          <p>{utility}</p>
        </div>
      </div>

      {cashStatus && (
        <div className="card">
          <h3>Caja abierta (turno actual)</h3>
          <p>Efectivo esperado actual: {cashStatus.expectedCash}</p>
        </div>
      )}

      <div className="card">
        <h3>Ventas por día (últimos 7 días)</h3>
        <Bar
          data={{
            labels: chartLabels,
            datasets: [{ label: 'Ventas', data: chartData }],
          }}
        />
      </div>
    </div>
  );
};