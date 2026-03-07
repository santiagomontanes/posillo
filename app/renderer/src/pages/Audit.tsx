import { useEffect, useMemo, useState } from 'react';
import { ipc } from '../services/ipcClient';
import { getAuthContext } from '../services/session';

function fmtDate(v: any): string {
  if (!v) return '';
  if (v instanceof Date) return v.toLocaleString('es-CO');

  const s = String(v);
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toLocaleString('es-CO');

  return s;
}

function fmtText(v: any): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);

  if (v instanceof Date) return v.toLocaleString('es-CO');

  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function fmtMetadata(v: any): string {
  if (!v) return '';

  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return '';
    try {
      const parsed = JSON.parse(s);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return s;
    }
  }

  try {
    return JSON.stringify(v, null, 2);
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
  const [expandedId, setExpandedId] = useState<string>('');

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
    } catch (e: any) {
      console.error('[audit.refresh]', e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const actionsInData = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) set.add(String(r.action ?? ''));
    return Array.from(set).filter(Boolean).sort();
  }, [rows]);

  const actorsInData = useMemo(() => {
    const map = new Map<string, string>();

    for (const r of rows) {
      const id = String(r.actor_user_id ?? r.actorId ?? '');
      if (!id) continue;

      const name = String(
        r.actor_name ??
          r.actorName ??
          r.actor_email ??
          r.actorEmail ??
          id,
      );

      map.set(id, name);
    }

    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [rows]);

  return (
    <div className="dashboard">
      <div className="card dashboard__hero">
        <div>
          <div className="dashboard__eyebrow">Auditoría</div>
          <h2 className="dashboard__title">Historial de movimientos del sistema</h2>
          <p className="dashboard__text">
            Consulta quién hizo cambios, cuándo los hizo y sobre qué entidad del sistema.
          </p>
        </div>
      </div>

      <div className="card">
        <div className="dashboard__section-title">Filtros</div>

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

        <div className="grid grid-2" style={{ marginTop: 10 }}>
          <label style={{ display: 'grid', gap: 8 }}>
            <span style={{ color: 'var(--muted)', fontWeight: 700 }}>Usuario</span>
            <select value={actorId} onChange={(e) => setActorId(e.target.value)}>
              <option value="">Todos</option>
              {actorsInData.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: 'grid', gap: 8 }}>
            <span style={{ color: 'var(--muted)', fontWeight: 700 }}>Acción</span>
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

        <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
          <button onClick={() => void refresh()} disabled={loading}>
            {loading ? 'Cargando...' : 'Filtrar'}
          </button>

          <button
            className="btn btn--ghost"
            onClick={() => {
              setFrom(today);
              setTo(today);
              setActorId('');
              setAction('');
              setExpandedId('');
            }}
            disabled={loading}
          >
            Limpiar filtros
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            alignItems: 'center',
            marginBottom: 10,
            flexWrap: 'wrap',
          }}
        >
          <div className="dashboard__section-title">Registros encontrados</div>
          <div style={{ opacity: 0.8 }}>Total: {rows.length}</div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Actor</th>
                <th>Acción</th>
                <th>Entidad</th>
                <th>ID entidad</th>
                <th>Detalle</th>
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ opacity: 0.8, padding: 14 }}>
                    Sin registros para mostrar.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const rowId = String(
                    r.id ?? `${r.action}-${r.created_at}-${r.entity_id ?? ''}`,
                  );

                  const expanded = expandedId === rowId;
                  const metadataText = fmtMetadata(r.metadata);

                  return (
                    <>
                      <tr key={rowId}>
                        <td>{fmtDate(r.created_at ?? r.createdAt)}</td>

                        <td>
                          {fmtText(
                            r.actor_name ??
                              r.actorName ??
                              r.actor_email ??
                              r.actorEmail ??
                              r.actor_user_id ??
                              r.actorId,
                          )}
                        </td>

                        <td>{fmtText(r.action)}</td>
                        <td>{fmtText(r.entity_type ?? r.entityType)}</td>
                        <td>{fmtText(r.entity_id ?? r.entityId)}</td>

                        <td>
                          <button
                            className="btn btn--ghost"
                            onClick={() =>
                              setExpandedId(expanded ? '' : rowId)
                            }
                          >
                            {expanded ? 'Ocultar' : 'Ver'}
                          </button>
                        </td>
                      </tr>

                      {expanded && (
                        <tr key={`${rowId}-detail`}>
                          <td colSpan={6} style={{ padding: 0 }}>
                            <div
                              style={{
                                margin: '8px 0 14px 0',
                                padding: 14,
                                borderRadius: 14,
                                background: 'rgba(255,255,255,.03)',
                                border: '1px solid rgba(255,255,255,.06)',
                              }}
                            >
                              <div
                                style={{
                                  fontWeight: 800,
                                  marginBottom: 10,
                                  color: 'var(--muted)',
                                }}
                              >
                                Metadata
                              </div>

                              <pre
                                style={{
                                  margin: 0,
                                  whiteSpace: 'pre-wrap',
                                  wordBreak: 'break-word',
                                  fontSize: 12,
                                  lineHeight: 1.5,
                                  fontFamily:
                                    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                                }}
                              >
                                {metadataText || 'Sin metadata'}
                              </pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};