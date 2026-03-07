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
  if (!isFinite(n)) return '0';
  return n.toLocaleString('es-CO');
}

// ✅ Convierte "YYYY-MM-DD" a ISO inicio/fin de día (local)
function rangeFromDateInputs(from: string, to: string): { fromIso: string; toIso: string } {
  // Inicio del día
  const start = new Date(`${from}T00:00:00`);
  // Fin del día
  const end = new Date(`${to}T23:59:59.999`);

  // Si por alguna razón vienen mal, no revientes
  const fromIso = isNaN(start.getTime()) ? '' : start.toISOString();
  const toIso = isNaN(end.getTime()) ? '' : end.toISOString();

  return { fromIso, toIso };
}

export const Expenses = ({ user }: { user: any }) => {
  const [from, setFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<any[]>([]);
  const [concept, setConcept] = useState('');
  const [amount, setAmount] = useState(0);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const refresh = async (): Promise<void> => {
    try {
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
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  const total = useMemo(() => rows.reduce((acc, r) => acc + Number(r.amount ?? 0), 0), [rows]);

  return (
    <div className="card">
      <h3>Gastos</h3>

      <div className="grid grid-2">
        <label>
          Desde:
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          Hasta:
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>

      <button onClick={() => void refresh()}>Refrescar</button>

      {error && (
        <div className="pos__msg" style={{ marginTop: 10 }}>
          {error}
        </div>
      )}

      <div className="card">
        <h4>Agregar gasto</h4>

        <label>
          Concepto:
          <input value={concept} onChange={(e) => setConcept(e.target.value)} />
        </label>

        <label>
          Valor:
          <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value || 0))} />
        </label>

        <label>
          Notas:
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        </label>

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
                  // ✅ Guarda con ISO (fecha+hora)
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

      <div className="card">
        <h4>Listado</h4>
        <p>Total: {fmtMoney(total)}</p>

        <div className="table">
          {rows.map((e) => (
            <div key={String(e.id)} className="row">
              <div style={{ width: 220 }}>{fmtDate(e.date ?? e.created_at)}</div>
              <div style={{ flex: 1 }}>{String(e.concept ?? '')}</div>
              <div style={{ width: 140, textAlign: 'right' }}>{fmtMoney(e.amount)}</div>
            </div>
          ))}

          {rows.length === 0 && <div style={{ opacity: 0.8, padding: 10 }}>No hay gastos para mostrar.</div>}
        </div>
      </div>
    </div>
  );
};