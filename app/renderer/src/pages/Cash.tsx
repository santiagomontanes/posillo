import { useEffect, useMemo, useState } from 'react';
import { ipc } from '../services/ipcClient';
import { getAuthContext } from '../services/session';
import { printInvoice } from '../services/sales';
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
  return n.toLocaleString('es-CO');
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
      alert(err?.message || 'No se pudo refrescar el estado de caja.');
    }
  };

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 5000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    alert('No se encontró la sesión de caja abierta.');
    return;
  }

  if (!user?.id) {
    alert('No se encontró el usuario actual.');
    return;
  }

  setLoading(true);

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

    console.log('[cash.close] result:', res);

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

    await printInvoice(html);

    alert(
      `Caja cerrada correctamente.\nDiferencia: ${fmtMoney(res?.diff)}\nBackup: ${
        res?.backupPath ?? 'N/A'
      }`,
    );

    setCounted(0);
    await refresh();
  } catch (err: any) {
    console.error('[cash.close] error:', err);
    alert(err?.message || 'No se pudo cerrar la caja.');
  } finally {
    setLoading(false);
  }
};

  const handleOpenCash = async () => {
    if (openingDiffersFromSuggestion && !openingNotes.trim()) {
      alert('Debes ingresar una nota/justificación cuando el efectivo inicial difiere del sugerido.');
      return;
    }

    setLoading(true);

    try {
      const res = await ipc.cash.open({
        ...getAuthContext(),
        cash: {
          userId: user.id,
          openingCash: Number(opening || 0),
          openingNotes: openingNotes.trim(),
        },
      });

      console.log('[cash.open] result:', res);

      setTouched(false);
      setOpeningNotes('');
      await refresh();
    } catch (err: any) {
      console.error('[cash.open] error:', err);
      alert(err?.message || 'No se pudo abrir la caja.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      {open ? (
        <>
          <h3>Caja abierta</h3>

          <p>Fecha/Hora apertura: {fmtDate(openedAtValue)}</p>

          {hasSuggestion ? <p>Sugerido último cierre: {fmtMoney(suggestion.suggestedOpeningCash)}</p> : null}

          <div className="grid grid-2">
            <div className="card">
              <b>Inicio de caja</b>
              <p>{fmtMoney(status?.openingCash ?? open?.opening_cash ?? open?.openingCash ?? 0)}</p>
            </div>

            <div className="card">
              <b>Ventas en efectivo (turno)</b>
              <p>{fmtMoney(status?.cashSales ?? 0)}</p>
            </div>

            <div className="card">
              <b>Gastos (turno)</b>
              <p>{fmtMoney(status?.expenses ?? 0)}</p>
            </div>

            <div className="card">
              <b>Efectivo esperado</b>
              <p>{fmtMoney(expectedCash)}</p>
            </div>
          </div>

          <button onClick={() => void refresh()} disabled={loading}>
            Refrescar
          </button>

          <div className="card">
            <h4>Cierre de caja</h4>
            <p>Efectivo esperado: {fmtMoney(expectedCash)}</p>

            <label>
              Efectivo contado:
              <input
                type="number"
                value={counted}
                onChange={(e) => setCounted(Number(e.target.value || 0))}
              />
            </label>

            <p>Diferencia: {fmtMoney(diff)}</p>

            <button onClick={() => void handleCloseCash()} disabled={loading}>
              {loading ? 'Cerrando...' : 'Confirmar cierre'}
            </button>
          </div>
        </>
      ) : (
        <>
          <h3>Abrir caja</h3>

          <p>
            Efectivo sugerido (último cierre):{' '}
            {hasSuggestion ? fmtMoney(suggestion.suggestedOpeningCash) : 'Sin datos previos'}
          </p>

          {lastClosedAtValue ? <p>Último cierre: {fmtDate(lastClosedAtValue)}</p> : null}

          <label>
            Efectivo inicial (hoy):
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
            <label>
              Nota / Justificación:
              <textarea
                value={openingNotes}
                onChange={(e) => setOpeningNotes(e.target.value)}
                rows={3}
              />
            </label>
          ) : null}

          <button onClick={() => void handleOpenCash()} disabled={loading}>
            {loading ? 'Abriendo...' : 'Abrir caja'}
          </button>
        </>
      )}
    </div>
  );
};