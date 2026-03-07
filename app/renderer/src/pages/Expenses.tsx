import { useEffect, useMemo, useState } from 'react';
import { ipc } from '../services/ipcClient';
import { getAuthContext } from '../services/session';

function fmtDate(v: any): string {
  if (!v) return '';
  if (v instanceof Date) return v.toLocaleString();

  const s = String(v);
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toLocaleString();

  return s;
}

function fmtMoney(v: any): string {
  const n = Number(v ?? 0);
  if (!isFinite(n)) return '$0';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(n);
}

function localYmd(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function rangeFromDateInputs(from: string, to: string): { fromIso: string; toIso: string } {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T23:59:59.999`);

  const fromIso = isNaN(start.getTime()) ? '' : start.toISOString();
  const toIso = isNaN(end.getTime()) ? '' : end.toISOString();

  return { fromIso, toIso };
}

export const Expenses = ({ user }: { user: any }) => {
  const [from, setFrom] = useState(() => localYmd(new Date()));
  const [to, setTo] = useState(() => localYmd(new Date()));
  const [rows, setRows] = useState<any[]>([]);
  const [concept, setConcept] = useState('');
  const [amount, setAmount] = useState(0);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const refresh = async (): Promise<void> => {
    try {
      setLoading(true);
      setError('');

      const { fromIso, toIso } = rangeFromDateInputs(from, to);

      const list = await ipc.expenses.list({
        ...getAuthContext(),
        from: fromIso,
        to: toIso,
      });

      setRows(Array.isArray(list) ? list : []);
    } catch (e: any) {
      setRows([]);
      setError(e?.message || 'No se pudieron cargar los gastos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  const total = useMemo(
    () => rows.reduce((acc, r) => acc + Number(r.amount ?? 0), 0),
    [rows],
  );

  return (
    <div className="dashboard">
      <div className="card dashboard__hero">
        <div>
          <div className="dashboard__eyebrow">Gastos</div>
          <h2 className="dashboard__title">Control de egresos</h2>
          <p className="dashboard__text">
            Registra y consulta los gastos del negocio por rango de fechas.
          </p>
        </div>
      </div>

      <div className="card">
        <div className="dashboard__section-title">Filtrar gastos</div>

        <div className="grid grid-2">
          <label style={{ display: 'grid', gap: 8 }}>
            <span style={{ color: 'var(--muted)', fontWeight: 700 }}>Desde</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>

          <label style={{ display: 'grid', gap: 8 }}>
            <span style={{ color: 'var(--muted)', fontWeight: 700 }}>Hasta</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>

        <div style={{ marginTop: 16 }}>
          <button className="btn btn--ghost" onClick={() => void refresh()} disabled={loading}>
            {loading ? 'Cargando...' : 'Refrescar'}
          </button>
        </div>

        {error && (
          <div className="pos__msg" style={{ marginTop: 12 }}>
            {error}
          </div>
        )}
      </div>

      <div className="card">
        <div className="dashboard__section-title">Agregar gasto</div>

        <div className="grid grid-2">
          <label style={{ display: 'grid', gap: 8 }}>
            <span style={{ color: 'var(--muted)', fontWeight: 700 }}>Concepto</span>
            <input value={concept} onChange={(e) => setConcept(e.target.value)} />
          </label>

          <label style={{ display: 'grid', gap: 8 }}>
            <span style={{ color: 'var(--muted)', fontWeight: 700 }}>Valor</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value || 0))}
            />
          </label>
        </div>

        <div style={{ marginTop: 12 }}>
          <label style={{ display: 'grid', gap: 8 }}>
            <span style={{ color: 'var(--muted)', fontWeight: 700 }}>Notas</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </label>
        </div>

        <div style={{ marginTop: 16 }}>
          <button
            onClick={async () => {
              try {
                setError('');

                if (!concept.trim()) {
                  alert('Concepto requerido');
                  return;
                }

                await ipc.expenses.add({
                  ...getAuthContext(),
                  expense: {
                    date: new Date().toISOString(),
                    concept: concept.trim(),
                    amount: Number(amount ?? 0),
                    notes: notes.trim(),
                    userId: user?.id,
                  },
                });

                setConcept('');
                setAmount(0);
                setNotes('');
                await refresh();
              } catch (e: any) {
                setError(e?.message || 'No se pudo guardar el gasto.');
              }
            }}
          >
            Guardar gasto
          </button>
        </div>
      </div>

      <div className="card">
        <div className="dashboard__section-title">Listado de gastos</div>

        <div
          style={{
            marginBottom: 14,
            padding: 14,
            borderRadius: 14,
            background: 'rgba(255,255,255,.03)',
            border: '1px solid rgba(255,255,255,.06)',
          }}
        >
          <div style={{ color: 'var(--muted)', fontWeight: 700, marginBottom: 6 }}>
            Total del período
          </div>
          <div style={{ fontSize: 26, fontWeight: 900 }}>{fmtMoney(total)}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Concepto</th>
              <th style={{ textAlign: 'right' }}>Valor</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={String(e.id)}>
                <td>{fmtDate(e.date ?? e.created_at)}</td>
                <td>{String(e.concept ?? '')}</td>
                <td style={{ textAlign: 'right', fontWeight: 800 }}>{fmtMoney(e.amount)}</td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td colSpan={3} style={{ opacity: 0.8, padding: 12 }}>
                  No hay gastos para mostrar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};