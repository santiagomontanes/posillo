import { useState } from 'react';
import { login } from '../services/auth';

type LoginUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  mustChangePassword?: boolean;
};

export const Login = ({ onLogin }: { onLogin: (u: any) => void }) => {
  const [email, setEmail] = useState('admin@sistetecni.com');
  const [password, setPassword] = useState('admin'); // sugerido: por defecto "admin" la primera vez
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (): Promise<void> => {
    if (loading) return;

    setError('');
    setLoading(true);

    try {
      const u = (await login(email.trim(), password)) as LoginUser;

      // ✅ Bloqueo: si debe cambiar contraseña, NO lo dejes entrar normal
      if (u?.mustChangePassword) {
        // Le pasamos al padre una señal para que navegue a "cambiar contraseña"
        onLogin({ ...u, _forceChangePassword: true });
        return;
      }

      onLogin(u);
    } catch (e: any) {
      const msg = String(e?.message ?? e ?? 'Error');
      // Mensaje amigable
      if (msg.toLowerCase().includes('credenciales')) setError('Credenciales inválidas.');
      else setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="main">
      <div className="card grid" style={{ gap: 12 }}>
        <h1>Ingreso</h1>

        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Correo"
          autoComplete="username"
          disabled={loading}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit();
          }}
        />

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Contraseña"
          autoComplete="current-password"
          disabled={loading}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit();
          }}
        />

        <button onClick={() => void submit()} disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>

        {!!error && <small style={{ color: '#ff8a8a' }}>{error}</small>}
      </div>
    </div>
  );
};