import { useEffect, useMemo, useState } from 'react';
import { ipc } from '../services/ipcClient';
import { getAuthContext } from '../services/session';
import { buildCashCloseHtml } from '../reports/cashCloseTemplate';
import { getConfig } from '../services/config';

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
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(n);
}

function writeHtmlDocument(target: Window | null, title: string, html: string): void {
  if (!target) {
    alert('No se pudo abrir la vista previa del documento.');
    return;
  }

  target.document.open();
  target.document.write(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <style>
          body {
            margin: 0;
            background: #f3f4f6;
            font-family: Arial, sans-serif;
          }
          .toolbar {
            position: sticky;
            top: 0;
            z-index: 10;
            background: #111827;
            color: white;
            padding: 12px 16px;
            display: flex;
            gap: 10px;
            align-items: center;
            justify-content: space-between;
          }
          .toolbar button {
            border: 0;
            border-radius: 10px;
            padding: 10px 14px;
            cursor: pointer;
            font-weight: 700;
          }
          .toolbar .primary {
            background: #2563eb;
            color: white;
          }
          .toolbar .ghost {
            background: #374151;
            color: white;
          }
          .sheet {
            max-width: 900px;
            margin: 20px auto;
            background: white;
            box-shadow: 0 10px 30px rgba(0,0,0,.12);
          }
          @media print {
            .toolbar { display: none !important; }
            body { background: white; }
            .sheet {
              box-shadow: none;
              max-width: 100%;
              margin: 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="toolbar">
          <div>${title}</div>
          <div style="display:flex; gap:10px;">
            <button class="primary" onclick="window.print()">Imprimir / Guardar PDF</button>
            <button class="ghost" onclick="window.close()">Cerrar</button>
          </div>
        </div>
        <div class="sheet">${html}</div>
      </body>
    </html>
  `);
  target.document.close();
}

export const Cash = ({ user }: { user: any }) => {
  const [open, setOpen] = useState<any>(null);
  const [status, setStatus] = useState<any>(null);
  const [suggestion, setSuggestion] = useState<any>(null);

  const [opening, setOpening] = useState(0);
  const [openingNotes, setOpeningNotes] = useState('');
  const [touched, setTouched] = useState(false);

  const [counted, setCounted] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const refresh = async (): Promise<void> => {
    try {
      const [openCash, cashStatus, openSuggestion] = await Promise.all([
        ipc.cash.getOpen(getAuthContext()),
        ipc.cash.getStatus(getAuthContext()),
        ipc.cash.getOpenSuggestion(getAuthContext()),
      ]);

      setOpen(openCash);
      setStatus(cashStatus);
      setSuggestion(openSuggestion);

      if (!openCash && !touched && typeof openSuggestion?.suggestedOpeningCash === 'number') {
        const suggested = Number(openSuggestion.suggestedOpeningCash);
        if (opening === 0 || opening === suggested) {
          setOpening(suggested);
        }
      }
    } catch (err: any) {
      console.error('[cash.refresh] error:', err);
      setMessage(err?.message || 'No se pudo refrescar el estado de caja.');
    }
  };

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 5000);
    return () => clearInterval(timer);
  }, []);

  const expectedCash = Number(status?.expectedCash ?? 0);
  const diff = useMemo(() => Number(counted || 0) - expectedCash, [counted, expectedCash]);

  const hasSuggestion = typeof suggestion?.suggestedOpeningCash === 'number';
  const openingDiffersFromSuggestion =
    hasSuggestion && Number(opening) !== Number(suggestion.suggestedOpeningCash);

  const openedAtValue = status?.openedAt ?? open?.opened_at ?? open?.openedAt ?? '';
  const lastClosedAtValue = suggestion?.lastClosedAt ?? '';
  const sessionId = open?.id ?? open?.session_id ?? open?.sessionId ?? null;

  const handleCloseCash = async () => {
    if (!sessionId) {
      setMessage('No se encontró la sesión de caja abierta.');
      return;
    }

    if (!user?.id) {
      setMessage('No se encontró el usuario actual.');
      return;
    }

    // Abrir la ventana ANTES del await
    const preview = window.open('', '_blank', 'width=1000,height=800');

    if (!preview) {
      setMessage('No se pudo abrir la ventana del comprobante.');
      return;
    }

    preview.document.open();
    preview.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Generando comprobante...</title>
          <style>
            body {
              margin: 0;
              font-family: Arial, sans-serif;
              background: #f3f4f6;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              color: #111827;
            }
            .box {
              background: white;
              padding: 24px;
              border-radius: 14px;
              box-shadow: 0 10px 30px rgba(0,0,0,.12);
              font-weight: 700;
            }
          </style>
        </head>
        <body>
          <div class="box">Generando comprobante de cierre de caja...</div>
        </body>
      </html>
    `);
    preview.document.close();

    setLoading(true);
    setMessage('');

    try {
      const res = await ipc.cash.close({
        ...getAuthContext(),
        cash: {
          id: sessionId,
          countedCash: Number(counted || 0),
          userId: user.id,
          notes: '',
        },
      });

      let businessName = 'Sistetecni POS';
      try {
        const cfg = await getConfig();
        businessName = cfg?.business?.name || 'Sistetecni POS';
      } catch {}

      const html = buildCashCloseHtml({
        businessName,
        cashierName: user?.name || user?.email || 'Administrador',
        openedAt: fmtDate(res?.openedAt || openedAtValue),
        closedAt: fmtDate(res?.closedAt),
        openingCash: Number(res?.openingCash ?? 0),
        cashSales: Number(res?.cashSales ?? 0),
        totalExpenses: Number(res?.totalExpenses ?? 0),
        expectedCash: Number(res?.expectedCash ?? 0),
        countedCash: Number(res?.countedCash ?? 0),
        diff: Number(res?.diff ?? 0),
      });

      writeHtmlDocument(preview, `Cierre de caja ${fmtDate(res?.closedAt)}`, html);

      setMessage(
        `Caja cerrada correctamente. Diferencia: ${fmtMoney(res?.diff)}. Backup: ${res?.backupPath ?? 'N/A'}`,
      );

      setCounted(0);
      await refresh();
    } catch (err: any) {
      console.error('[cash.close] error:', err);
      try {
        preview.close();
      } catch {}
      setMessage(err?.message || 'No se pudo cerrar la caja.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCash = async () => {
    if (openingDiffersFromSuggestion && !openingNotes.trim()) {
      setMessage('Debes ingresar una nota o justificación cuando el efectivo inicial difiere del sugerido.');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      await ipc.cash.open({
        ...getAuthContext(),
        cash: {
          userId: user.id,
          openingCash: Number(opening || 0),
          openingNotes: openingNotes.trim(),
        },
      });

      setTouched(false);
      setOpeningNotes('');
      setMessage('Caja abierta correctamente.');
      await refresh();
    } catch (err: any) {
      console.error('[cash.open] error:', err);
      setMessage(err?.message || 'No se pudo abrir la caja.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard">
      <div className="card dashboard__hero">
        <div>
          <div className="dashboard__eyebrow">Control de caja</div>
          <h2 className="dashboard__title">
            {open ? 'Caja abierta' : 'Apertura de caja'}
          </h2>
          <p className="dashboard__text">
            Gestiona apertura, cierre y control del efectivo del turno actual.
          </p>
        </div>
      </div>

      {message ? (
        <div className="pos__msg" style={{ marginBottom: 14 }}>
          {message}
        </div>
      ) : null}

      {open ? (
        <>
          <div className="card dashboard__cash-card">
            <div className="dashboard__section-title">Resumen del turno</div>
            <p className="dashboard__cash-value">
              Fecha/Hora apertura: <strong>{fmtDate(openedAtValue)}</strong>
            </p>

            {hasSuggestion ? (
              <p className="dashboard__cash-value">
                Sugerido último cierre: <strong>{fmtMoney(suggestion.suggestedOpeningCash)}</strong>
              </p>
            ) : null}
          </div>

          <div className="grid grid-2 dashboard__stats">
            <div className="card stat-card">
              <div className="stat-card__label">Inicio de caja</div>
              <div className="stat-card__value">
                {fmtMoney(status?.openingCash ?? open?.opening_cash ?? open?.openingCash ?? 0)}
              </div>
            </div>

            <div className="card stat-card">
              <div className="stat-card__label">Ventas en efectivo (turno)</div>
              <div className="stat-card__value">{fmtMoney(status?.cashSales ?? 0)}</div>
            </div>

            <div className="card stat-card">
              <div className="stat-card__label">Gastos del turno</div>
              <div className="stat-card__value">{fmtMoney(status?.expenses ?? 0)}</div>
            </div>

            <div className="card stat-card">
              <div className="stat-card__label">Efectivo esperado</div>
              <div className="stat-card__value">{fmtMoney(expectedCash)}</div>
            </div>
          </div>

          <div className="card dashboard__cash-card">
            <div className="dashboard__section-title">Cierre de caja</div>

            <p className="dashboard__cash-value">
              Efectivo esperado: <strong>{fmtMoney(expectedCash)}</strong>
            </p>

            <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
              <label style={{ display: 'grid', gap: 8 }}>
                <span style={{ color: 'var(--muted)', fontWeight: 700 }}>Efectivo contado</span>
                <input
                  type="number"
                  value={counted}
                  onChange={(e) => setCounted(Number(e.target.value || 0))}
                />
              </label>

              <div
                style={{
                  padding: 14,
                  borderRadius: 14,
                  background: 'rgba(255,255,255,.03)',
                  border: '1px solid rgba(255,255,255,.06)',
                }}
              >
                <div style={{ color: 'var(--muted)', fontWeight: 700, marginBottom: 6 }}>
                  Diferencia
                </div>
                <div style={{ fontSize: 24, fontWeight: 900 }}>
                  {fmtMoney(diff)}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={() => void refresh()} disabled={loading} className="btn btn--ghost">
                  Refrescar
                </button>

                <button onClick={() => void handleCloseCash()} disabled={loading}>
                  {loading ? 'Cerrando...' : 'Confirmar cierre'}
                </button>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="card dashboard__cash-card">
            <div className="dashboard__section-title">Abrir caja</div>

            <p className="dashboard__cash-value">
              Efectivo sugerido (último cierre):{' '}
              <strong>
                {hasSuggestion ? fmtMoney(suggestion.suggestedOpeningCash) : 'Sin datos previos'}
              </strong>
            </p>

            {lastClosedAtValue ? (
              <p className="dashboard__cash-value">
                Último cierre: <strong>{fmtDate(lastClosedAtValue)}</strong>
              </p>
            ) : null}

            <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
              <label style={{ display: 'grid', gap: 8 }}>
                <span style={{ color: 'var(--muted)', fontWeight: 700 }}>Efectivo inicial (hoy)</span>
                <input
                  type="number"
                  value={opening}
                  onChange={(e) => {
                    setTouched(true);
                    setOpening(Number(e.target.value || 0));
                  }}
                />
              </label>

              {openingDiffersFromSuggestion ? (
                <label style={{ display: 'grid', gap: 8 }}>
                  <span style={{ color: 'var(--muted)', fontWeight: 700 }}>
                    Nota / Justificación
                  </span>
                  <textarea
                    value={openingNotes}
                    onChange={(e) => setOpeningNotes(e.target.value)}
                    rows={3}
                  />
                </label>
              ) : null}

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={() => void handleOpenCash()} disabled={loading}>
                  {loading ? 'Abriendo...' : 'Abrir caja'}
                </button>

                <button onClick={() => void refresh()} disabled={loading} className="btn btn--ghost">
                  Refrescar
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};