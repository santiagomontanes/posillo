import { useEffect, useState } from 'react';
import { getAuthContext } from '../services/session';

type DbMode = 'sqlite' | 'mysql';

type AppConfig = {
  dbMode: DbMode;
  mysql?: {
    host: string;
    user: string;
    password: string;
    database: string;
  };
};

declare global {
  interface Window {
    api: any;
  }
}

export const Settings = ({ role }: { role: 'ADMIN' | 'SUPERVISOR' | 'SELLER' }) => {
  const [loading, setLoading] = useState(true);

  const [dbMode, setDbMode] = useState<DbMode>('sqlite');
  const [host, setHost] = useState('');
  const [user, setUser] = useState('root');
  const [password, setPassword] = useState('');
  const [database, setDatabase] = useState('sistetecni_pos');

  // 🔥 FE STATES
  const [feEnabled, setFeEnabled] = useState(false);
  const [feBaseUrl, setFeBaseUrl] = useState('');
  const [feUser, setFeUser] = useState('');
  const [fePass, setFePass] = useState('');
  const [feClientId, setFeClientId] = useState('');
  const [feClientSecret, setFeClientSecret] = useState('');

  const [msg, setMsg] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const cfg = (await window.api.config.get()) as AppConfig;

        setDbMode(cfg?.dbMode ?? 'sqlite');
        setHost(cfg?.mysql?.host ?? '');
        setUser(cfg?.mysql?.user ?? 'root');
        setPassword(cfg?.mysql?.password ?? '');
        setDatabase(cfg?.mysql?.database ?? 'sistetecni_pos');

        // 🔥 CARGAR FE
        const fe = await window.api.electronicBilling.get();

        if (fe) {
          setFeEnabled(!!fe.enabled);
          setFeBaseUrl(fe.base_url ?? '');
          setFeUser(fe.username ?? '');
          setFePass(fe.password ?? '');
          setFeClientId(fe.client_id ?? '');
          setFeClientSecret(fe.client_secret ?? '');
        }
      } catch (e: any) {
        setMsg(e?.message || 'No se pudo cargar la configuración');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    setMsg('');
    try {
      if (role !== 'ADMIN') {
        setMsg('Solo ADMIN puede cambiar la configuración.');
        return;
      }

      const cfg: AppConfig =
        dbMode === 'mysql'
          ? {
              dbMode: 'mysql',
              mysql: {
                host: host.trim(),
                user: user.trim(),
                password: String(password ?? ''),
                database: database.trim(),
              },
            }
          : { dbMode: 'sqlite' };

      // 🔥 GUARDAR DB CONFIG
      await window.api.config.set({ ...getAuthContext(), ...cfg });

      // 🔥 GUARDAR FE CONFIG
      if (dbMode === 'mysql') {
        await window.api.electronicBilling.set({
          enabled: feEnabled ? 1 : 0,
          provider: 'factus',
          environment: 'sandbox',
          baseUrl: feBaseUrl,
          username: feUser,
          password: fePass,
          clientId: feClientId,
          clientSecret: feClientSecret,
        });
      }

      setMsg('Guardado. Reiniciando...');
    } catch (e: any) {
      setMsg(e?.message || 'No se pudo guardar');
    }
  };

  if (loading) return <div className="card">Cargando...</div>;

  return (
    <div className="dashboard">
      <div className="card dashboard__hero">
        <div>
          <div className="dashboard__eyebrow">Configuración</div>
          <h2 className="dashboard__title">Parámetros del sistema</h2>
          <p className="dashboard__text">
            Define el modo de base de datos y la facturación electrónica.
          </p>
        </div>
      </div>

      {/* ================= DB ================= */}
      <div className="card">
        <div className="dashboard__section-title">Base de datos</div>

        <div style={{ display: 'grid', gap: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="radio"
              checked={dbMode === 'sqlite'}
              onChange={() => setDbMode('sqlite')}
            />
            <span>SQLite (modo local)</span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="radio"
              checked={dbMode === 'mysql'}
              onChange={() => setDbMode('mysql')}
            />
            <span>MySQL (modo multicaja)</span>
          </label>
        </div>

        {dbMode === 'mysql' && (
          <div className="grid grid-2" style={{ marginTop: 16 }}>
            <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="Host" />
            <input value={database} onChange={(e) => setDatabase(e.target.value)} placeholder="DB" />
            <input value={user} onChange={(e) => setUser(e.target.value)} placeholder="User" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
          </div>
        )}

        {/* ================= FE ================= */}
        {dbMode === 'mysql' && (
          <div style={{ marginTop: 20 }}>
            <div className="dashboard__section-title">Facturación electrónica</div>

            <label>
              <input
                type="checkbox"
                checked={feEnabled}
                onChange={(e) => setFeEnabled(e.target.checked)}
              />
              Habilitar Facturación Electrónica
            </label>

            {feEnabled && (
              <div className="grid grid-2" style={{ marginTop: 10 }}>
                <input placeholder="Base URL" value={feBaseUrl} onChange={(e) => setFeBaseUrl(e.target.value)} />
                <input placeholder="Usuario" value={feUser} onChange={(e) => setFeUser(e.target.value)} />
                <input type="password" placeholder="Password" value={fePass} onChange={(e) => setFePass(e.target.value)} />
                <input placeholder="Client ID" value={feClientId} onChange={(e) => setFeClientId(e.target.value)} />
                <input placeholder="Client Secret" value={feClientSecret} onChange={(e) => setFeClientSecret(e.target.value)} />
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button onClick={save}>Guardar y reiniciar</button>

          <button
            className="btn btn--ghost"
            onClick={async () => {
              try {
                await window.api.mysql.initSchema();
                alert('Esquema creado correctamente.');
              } catch (err) {
                alert('Error creando el esquema.');
              }
            }}
          >
            Inicializar base de datos
          </button>
        </div>

        {msg && <div style={{ marginTop: 10 }}>{msg}</div>}
      </div>
    </div>
  );
};