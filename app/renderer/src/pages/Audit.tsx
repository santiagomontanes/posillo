import { useEffect, useMemo, useState } from 'react';
import { ipc } from '../services/ipcClient';
import { getAuthContext } from '../services/session';

function fmtDate(v: any): string {
  if (!v) return '';
  // Si ya es Date
  if (v instanceof Date) return v.toLocaleString('es-CO');

  // Si viene como string ISO / datetime
  const s = String(v);
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toLocaleString('es-CO');

  // fallback
  return s;
}

function fmtText(v: any): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);

  // objetos (incluye Date, JSON, etc.)
  if (v instanceof Date) return v.toLocaleString('es-CO');
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function fmtMetadata(v: any): string {
  if (!v) return '';
  // Si viene como string JSON desde MySQL (a veces mysql2 devuelve string)
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return '';
    try {
      const parsed = JSON.parse(s);
      return JSON.stringify(parsed, null, 0);
    } catch {
      return s;
    }
  }

  // Si viene como objeto
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export const Audit = () => {
  const today = new Date().toISOString().slice(0, 10);

  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [actorId, setActorId] = useState<string>('');
  const [action, setAction] = useState<string>('');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = async (): Promise<void> => {
    setLoading(true);
    try {
      const list = await ipc.audit.list({
        ...getAuthContext(),
        from,
        to,
        actorId: actorId || undefined,
        action: action || undefined,
        limit: 200,
        offset: 0,
      });

      setRows(Array.isArray(list) ? list : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const actionsInData = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) set.add(String(r.action ?? ''));
    return Array.from(set).filter(Boolean).sort();
  }, [rows]);

  const actorsInData = useMemo(() => {
    const set = new Map<string, string>();
    for (const r of rows) {
      const id = String(r.actor_user_id ?? r.actorId ?? '');
      if (!id) continue;
      const name = String(r.actor_name ?? r.actorName ?? r.actor_email ?? r.actorEmail ?? id);
      set.set(id, name);
    }
    return Array.from(set.entries()).map(([id, name]) => ({ id, name }));
  }, [rows]);

  return (
    <div className="card">
      <h3>Auditoría</h3>

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

      <div className="grid grid-2" style={{ marginTop: 8 }}>
        <label>
          Usuario:
          <select value={actorId} onChange={(e) => setActorId(e.target.value)}>
            <option value="">Todos</option>
            {actorsInData.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Acción:
          <select value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">Todas</option>
            {actionsInData.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button onClick={() => void refresh()} disabled={loading}>
          {loading ? 'Cargando...' : 'Filtrar'}
        </button>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>CREATED_AT</th>
                <th>ACTOR</th>
                <th>ACTION</th>
                <th>ENTITY_TYPE</th>
                <th>ENTITY_ID</th>
                <th>METADATA</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ opacity: 0.8 }}>
                    Sin registros (o filtro muy estricto)
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={String(r.id ?? `${r.action}-${r.created_at}-${Math.random()}`)}>
                    {/* ✅ nunca renderizar Date/objeto directo */}
                    <td>{fmtDate(r.created_at ?? r.createdAt)}</td>

                    <td>{fmtText(r.actor_name ?? r.actorName ?? r.actor_email ?? r.actorEmail ?? r.actor_user_id ?? r.actorId)}</td>

                    <td>{fmtText(r.action)}</td>

                    <td>{fmtText(r.entity_type ?? r.entityType)}</td>

                    <td>{fmtText(r.entity_id ?? r.entityId)}</td>

                    <td style={{ maxWidth: 420, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {fmtMetadata(r.metadata)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 8, opacity: 0.8 }}>
          Total: {rows.length}
        </div>
      </div>
    </div>
  );
};