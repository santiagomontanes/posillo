import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

export function RequireLicense({ children }: { children: JSX.Element }) {
  const api = (window as any).api;

  if (!api?.license?.status) {
    return (
      <div style={{ padding: 24, color: 'white' }}>
        API de licencia no disponible (preload)
      </div>
    );
  }

  const [loading, setLoading] = useState(true);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        // intenta validar online si hay internet
        if (api?.license?.checkOnline) {
          try {
            await api.license.checkOnline();
          } catch {
            // si no hay internet o falla el servidor, sigue con validación local
          }
        }

        const res = await api.license.status();

        if (!mounted) return;
        setOk(!!res?.ok);
      } catch {
        if (!mounted) return;
        setOk(false);
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [api]);

  if (loading) {
    return (
      <div style={{ padding: 24, color: 'white' }}>
        Verificando licencia...
      </div>
    );
  }

  if (!ok) {
    return <Navigate to="/activate" replace />;
  }

  return children;
}