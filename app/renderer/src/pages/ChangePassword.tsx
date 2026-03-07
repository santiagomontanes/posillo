import { useState } from 'react';

export const ChangePassword = ({
  user,
  onChanged,
}: {
  user: any;
  onChanged: () => void;
}) => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');

    if (!user?.id) {
      setError('No hay usuario en sesión (user.id vacío).');
      return;
    }

    if (password.length < 6) {
      setError('La contraseña debe tener mínimo 6 caracteres.');
      return;
    }

    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    try {
      await window.api.users.changePassword({
        userId: String(user.id),
        data: {
          id: String(user.id),          // ✅ objetivo (el mismo usuario)
          newPassword: String(password) // ✅ nueva clave
          // currentPassword: ''         // opcional si luego lo exiges
        },
      });

      alert('Contraseña actualizada correctamente.');
      onChanged();
    } catch (e: any) {
      setError(e?.message || 'Error al cambiar contraseña.');
    }
  };

  return (
    <div className="main">
      <div className="card grid">
        <h1>Cambiar contraseña obligatoria</h1>

        <input
          type="password"
          placeholder="Nueva contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <input
          type="password"
          placeholder="Confirmar contraseña"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />

        <button onClick={submit}>Actualizar contraseña</button>

        {error && <small style={{ color: 'red' }}>{error}</small>}
      </div>
    </div>
  );
};