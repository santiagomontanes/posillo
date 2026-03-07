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

      await window.api.config.set({ ...getAuthContext(), ...cfg });
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
            Define el modo de base de datos y los datos necesarios para operar en local o multicaja.
          </p>
        </div>
      </div>

      <div className="card">
        <div className="dashboard__section-title">Base de datos</div>

        <div style={{ display: 'grid', gap: 12 }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: 14,
              borderRadius: 14,
              background: 'rgba(255,255,255,.03)',
              border: '1px solid rgba(255,255,255,.06)',
            }}
          >
            <input
              type="radio"
              checked={dbMode === 'sqlite'}
              onChange={() => setDbMode('sqlite')}
            />
            <span>SQLite (modo local)</span>
          </label>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: 14,
              borderRadius: 14,
              background: 'rgba(255,255,255,.03)',
              border: '1px solid rgba(255,255,255,.06)',
            }}
          >
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
            <label style={{ display: 'grid', gap: 8 }}>
              <span style={{ color: 'var(--muted)', fontWeight: 700 }}>Host</span>
              <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="192.168.1.10" />
            </label>

            <label style={{ display: 'grid', gap: 8 }}>
              <span style={{ color: 'var(--muted)', fontWeight: 700 }}>Base de datos</span>
              <input value={database} onChange={(e) => setDatabase(e.target.value)} placeholder="sistetecni_pos" />
            </label>

            <label style={{ display: 'grid', gap: 8 }}>
              <span style={{ color: 'var(--muted)', fontWeight: 700 }}>Usuario</span>
              <input value={user} onChange={(e) => setUser(e.target.value)} placeholder="root" />
            </label>

            <label style={{ display: 'grid', gap: 8 }}>
              <span style={{ color: 'var(--muted)', fontWeight: 700 }}>Contraseña</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="123456"
              />
            </label>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
          <button onClick={save}>Guardar y reiniciar</button>

          <button
            className="btn btn--ghost"
            onClick={async () => {
              try {
                await window.api.mysql.initSchema();
                alert('Esquema creado correctamente.');
              } catch (err) {
                alert('Error creando el esquema.');
                console.error(err);
              }
            }}
          >
            Inicializar base de datos
          </button>
        </div>

        {msg && (
          <div
            style={{
              marginTop: 14,
              padding: 12,
              borderRadius: 12,
              background: 'rgba(255,255,255,.03)',
              border: '1px solid rgba(255,255,255,.06)',
              opacity: 0.95,
            }}
          >
            {msg}
          </div>
        )}
      </div>
    </div>
  );
};