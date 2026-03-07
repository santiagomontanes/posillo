import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { getMySqlPool } from '../mysql';



export async function changeUserPasswordMySql(input: {
  id: string;
  currentPassword: string | null;
  newPassword: string;
}): Promise<void> {
  const pool = getMySqlPool();

  // Traer hash actual
  const [rows] = await pool.query<any[]>(
    'SELECT password_hash FROM users WHERE id = ? LIMIT 1',
    [input.id],
  );
  const row = rows?.[0];
  if (!row) throw new Error('Usuario no existe');

  // Si mandan currentPassword, lo validamos (para self-change es lo ideal)
  if (input.currentPassword != null) {
    const ok = bcrypt.compareSync(String(input.currentPassword), String(row.password_hash ?? ''));
    if (!ok) throw new Error('Contraseña actual incorrecta');
  }

  const newHash = await bcrypt.hash(input.newPassword, 10);

  // Si tienes columna must_change_password, la apagamos (si no existe, quita esa parte)
  await pool.query(
    'UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?',
    [newHash, input.id],
  );
}

export type Role = 'ADMIN' | 'SUPERVISOR' | 'SELLER';

export async function listUsersMySql(): Promise<any[]> {
  const pool = getMySqlPool();
  const [rows] = await pool.query<any[]>(
    `SELECT id, name, email, role, created_at
     FROM users
     ORDER BY created_at DESC`,
  );
  return rows ?? [];
}

export async function listUsersBasicMySql(): Promise<any[]> {
  const pool = getMySqlPool();
  const [rows] = await pool.query<any[]>(
    `SELECT id, name, email, role
     FROM users
     ORDER BY name ASC`,
  );
  return rows ?? [];
}

export async function createUserMySql(payload: { name: string; email: string; password: string; role: Role }): Promise<string> {
  const pool = getMySqlPool();

  const email = String(payload?.email ?? '').trim().toLowerCase();
  const name = String(payload?.name ?? '').trim();
  const password = String(payload?.password ?? '');
  const role = payload?.role as Role;

  if (!email) throw new Error('Email requerido');
  if (!name) throw new Error('Nombre requerido');
  if (!password) throw new Error('Contraseña requerida');

  // valida duplicado
  const [existsRows] = await pool.query<any[]>(
    `SELECT id FROM users WHERE email = ? LIMIT 1`,
    [email],
  );
  if (existsRows?.[0]?.id) throw new Error('El email ya existe');

  const id = uuid();
  const hash = bcrypt.hashSync(password, 10);
  const nowIso = new Date().toISOString();

  await pool.execute(
    `INSERT INTO users (id, name, email, password_hash, role, created_at)
     VALUES (?,  ?,    ?,     ?,            ?,    ?)`,
    [id, name, email, hash, role, nowIso],
  );

  return id;
}

export async function resetUserPasswordMySql(payload: { id: string; newPassword: string }): Promise<void> {
  const pool = getMySqlPool();
  const id = String(payload?.id ?? '');
  const newPassword = String(payload?.newPassword ?? '');

  if (!id) throw new Error('Missing user id');
  if (!newPassword) throw new Error('Missing new password');

  const hash = bcrypt.hashSync(newPassword, 10);

  const [res]: any = await pool.execute(
    `UPDATE users SET password_hash = ? WHERE id = ?`,
    [hash, id],
  );

  const changed = Number(res?.affectedRows ?? res?.changedRows ?? 0);
  if (!changed) throw new Error('User not updated');
}