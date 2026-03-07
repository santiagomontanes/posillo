import { useEffect, useMemo, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { CategoryScale, Chart as ChartJS, LinearScale, BarElement } from 'chart.js';
import { salesByDay, summary, topProducts } from '../services/reports';

ChartJS.register(CategoryScale, LinearScale, BarElement);

// ✅ Convierte respuesta a array aunque venga envuelta: {rows:[]}, {data:[]}, etc.
const asArray = (v: any): any[] => {
  if (Array.isArray(v)) return v;
  if (Array.isArray(v?.rows)) return v.rows;
  if (Array.isArray(v?.data)) return v.data;
  if (Array.isArray(v?.result)) return v.result;
  if (Array.isArray(v?.items)) return v.items;
  return [];
};

// ✅ Convierte respuesta a objeto aunque venga envuelta: {data:{...}}, etc.
const asObject = (v: any): any => {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    if (v.data && typeof v.data === 'object') return v.data;
    if (v.row && typeof v.row === 'object') return v.row;
    if (v.result && typeof v.result === 'object') return v.result;
    return v;
  }
  return {};
};

// ✅ YYYY-MM-DD (mejor para BETWEEN)
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export const Reports = () => {
  const [data, setData] = useState<any[]>([]);
  const [top, setTop] = useState<any[]>([]);
  const [sum, setSum] = useState<any>({ total_sales: 0, total_costs: 0, total_expenses: 0, utility: 0 });
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
    <div>
      {error && <div className="card">Error: {error}</div>}

      <div className="card">
        <h3>Ventas por día</h3>
        <Bar
          data={{
            labels,
            datasets: [{ label: 'Ventas', data: totals }],
          }}
        />
      </div>

      <div className="card">
        <h3>Top productos</h3>
        {asArray(top).length === 0 && <div style={{ opacity: 0.8 }}>Sin datos.</div>}
        {asArray(top).map((t: any, i: number) => (
          <div key={String(t?.name ?? i)}>
            {String(t?.name ?? '')}: {Number(t?.qty ?? 0)}
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Resumen</h3>
        <p>Ventas: {sum.total_sales ?? 0}</p>
        <p>Gastos: {sum.total_expenses ?? 0}</p>
        <p>Utilidad estimada: {sum.utility ?? 0}</p>
      </div>
    </div>
  );
};