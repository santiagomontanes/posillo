import { useEffect, useState } from 'react';
import { createUser, listUsers, resetUserPassword } from '../services/users';

const fmtDate = (v: any): string => {
  if (!v) return '—';
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString('es-CO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const Users = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'SUPERVISOR' | 'SELLER'>('SELLER');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [resetId, setResetId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const load = async (): Promise<void> => {
    setUsers(await listUsers());
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div>
      <div className="card">
        <h2>Usuarios</h2>
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Creación</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {users.map((u: any) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td>Activo</td>
                <td>{fmtDate(u.created_at)}</td>
                <td>
                  <button onClick={() => setResetId(u.id)}>Resetear contraseña</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card grid">
        <h3>Crear usuario</h3>
        <input placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
        <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <select value={role} onChange={(e) => setRole(e.target.value as 'ADMIN' | 'SUPERVISOR' | 'SELLER')}>
          <option value="SELLER">SELLER</option>
          <option value="SUPERVISOR">SUPERVISOR</option>
          <option value="ADMIN">ADMIN</option>
        </select>
        <input type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} />
        <input
          type="password"
          placeholder="Confirmar contraseña"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        <button
          onClick={async () => {
            if (!name.trim() || !email.trim() || !password) return alert('Completa todos los campos obligatorios.');
            if (password !== confirmPassword) return alert('Las contraseñas no coinciden.');
            try {
              await createUser({ name: name.trim(), email: email.trim(), password, role });
              setName('');
              setEmail('');
              setRole('SELLER');
              setPassword('');
              setConfirmPassword('');
              await load();
            } catch (e: any) {
              alert(e?.message || 'No se pudo crear usuario.');
            }
          }}
        >
          Crear
        </button>
      </div>

      {resetId ? (
        <div className="card grid">
          <h3>Resetear contraseña</h3>
          <input
            type="password"
            placeholder="Nueva contraseña"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <input
            type="password"
            placeholder="Confirmar nueva contraseña"
            value={confirmNewPassword}
            onChange={(e) => setConfirmNewPassword(e.target.value)}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={async () => {
                if (!newPassword) return alert('Ingresa la nueva contraseña.');
                if (newPassword !== confirmNewPassword) return alert('Las contraseñas no coinciden.');
                try {
                  await resetUserPassword({ id: resetId, newPassword });
                  setResetId('');
                  setNewPassword('');
                  setConfirmNewPassword('');
                } catch (e: any) {
                  alert(e?.message || 'No se pudo resetear contraseña.');
                }
              }}
            >
              Guardar nueva contraseña
            </button>
            <button
              onClick={() => {
                setResetId('');
                setNewPassword('');
                setConfirmNewPassword('');
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};