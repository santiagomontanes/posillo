import { useEffect, useState } from 'react';

type LicenseStatusResponse = {
  ok: boolean;
  reason?: string;
  machineId?: string;
  plan?: 'MONTHLY' | 'YEARLY' | 'LIFETIME';
  expiresAt?: string | null;
  state?: {
    plan?: 'MONTHLY' | 'YEARLY' | 'LIFETIME';
    expiresAt?: string | null;
  };
};

const getDaysLeft = (expiresAt?: string | null): number | null => {
  if (!expiresAt) return null;

  const exp = new Date(expiresAt);
  if (isNaN(exp.getTime())) return null;

  const now = new Date();
  const diffMs = exp.getTime() - now.getTime();

  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
};

export const LicenseAlert = () => {
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const res: LicenseStatusResponse = await (window as any).api.license.status();

        const plan = res?.plan ?? res?.state?.plan ?? null;
        const expiresAt = res?.expiresAt ?? res?.state?.expiresAt ?? null;

        if (!active) return;

        if (!plan || plan === 'LIFETIME') {
          setDaysLeft(null);
          setExpired(false);
          return;
        }

        const days = getDaysLeft(expiresAt);

        if (days === null) {
          setDaysLeft(null);
          setExpired(false);
          return;
        }

        setDaysLeft(days);
        setExpired(days <= 0);
      } catch {
        if (!active) return;
        setDaysLeft(null);
        setExpired(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  if (daysLeft === null) return null;
  if (daysLeft > 7) return null;

  const whatsappNumber = '573043547758';

  const openWhatsApp = () => {
    const message = encodeURIComponent(
      expired
        ? 'Hola, mi licencia de Sistetecni POS ya venció y quiero renovarla.'
        : `Hola, a mi licencia de Sistetecni POS le quedan ${daysLeft} día${daysLeft === 1 ? '' : 's'} y quiero renovarla.`,
    );

    const url = `https://wa.me/${whatsappNumber}?text=${message}`;
    window.open(url, '_blank');
  };

  const borderColor = expired
    ? '1px solid rgba(255,80,80,.35)'
    : daysLeft <= 5
      ? '1px solid rgba(255,120,120,.35)'
      : '1px solid rgba(255,190,60,.35)';

  const background = expired
    ? 'rgba(170,20,20,.18)'
    : daysLeft <= 5
      ? 'rgba(176,0,32,.14)'
      : 'rgba(255,190,60,.12)';

  const title = expired
    ? 'Licencia vencida'
    : daysLeft <= 5
      ? 'Tu licencia está por vencer muy pronto'
      : 'Tu licencia está próxima a vencer';

  const message = expired
    ? 'Debes realizar el pago para continuar usando Sistetecni POS.'
    : `Quedan ${daysLeft} día${daysLeft === 1 ? '' : 's'} para que termine tu plan. Recuerda realizar el pago para evitar interrupciones.`;

  return (
    <div
      style={{
        marginBottom: 16,
        padding: '14px 16px',
        borderRadius: 14,
        border: borderColor,
        background,
        color: '#fff',
        fontWeight: 700,
        boxShadow: '0 8px 24px rgba(0,0,0,.18)',
      }}
    >
      <div style={{ fontSize: 16, marginBottom: 4 }}>{title}</div>

      <div style={{ opacity: 0.92, fontWeight: 500 }}>{message}</div>

      <button
        onClick={openWhatsApp}
        style={{
          marginTop: 10,
          padding: '8px 14px',
          borderRadius: 10,
          border: 'none',
          background: '#25D366',
          color: 'white',
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        Renovar por WhatsApp
      </button>
    </div>
  );
};