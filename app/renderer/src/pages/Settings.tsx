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
      // (Opcional) Asegurar que solo ADMIN pueda cambiar esto (además del backend)
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

      // Guardar y reiniciar (tu IPC ya hace relaunch)
      await window.api.config.set({ ...getAuthContext(), ...cfg });
      // Si reinicia, esto no se ve. Pero si no reinicia por alguna razón:
      setMsg('Guardado. Reiniciando...');
    } catch (e: any) {
      setMsg(e?.message || 'No se pudo guardar');
    }
  };

  if (loading) return <div className="card">Cargando...</div>;

  return (
    <div className="card">
      <h3>Configuración</h3>

      <div className="card" style={{ marginTop: 12 }}>
        <h4>Base de datos</h4>

        <label style={{ display: 'block', marginBottom: 8 }}>
          <input
            type="radio"
            checked={dbMode === 'sqlite'}
            onChange={() => setDbMode('sqlite')}
          />{' '}
          SQLite (modo local)
        </label>

        <label style={{ display: 'block', marginBottom: 12 }}>
          <input
            type="radio"
            checked={dbMode === 'mysql'}
            onChange={() => setDbMode('mysql')}
          />{' '}
          MySQL (modo multicaja)
        </label>

        {dbMode === 'mysql' && (
          <div className="grid grid-2">
            <label>
              Host:
              <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="192.168.101.83" />
            </label>

            <label>
              Base de datos:
              <input value={database} onChange={(e) => setDatabase(e.target.value)} placeholder="sistetecni_pos" />
            </label>

            <label>
              Usuario:
              <input value={user} onChange={(e) => setUser(e.target.value)} placeholder="root" />
            </label>

            <label>
              Contraseña:
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="123456" />
            </label>
          </div>
        )}

        <button style={{ marginTop: 12 }} onClick={save}>
          Guardar y reiniciar
        </button>

        <button
  className="btn"
  onClick={async () => {
    try {
      await window.api.mysql.initSchema();
      alert("Esquema creado correctamente.");
    } catch (err) {
      alert("Error creando el esquema.");
      console.error(err);
    }
  }}
>
  Inicializar base de datos
</button>

        {msg && <div style={{ marginTop: 10, opacity: 0.9 }}>{msg}</div>}
      </div>
    </div>
  );
};