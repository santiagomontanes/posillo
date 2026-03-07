import bcrypt from 'bcryptjs';
import { getMySqlPool } from '../mysql';

export type Role = 'ADMIN' | 'SUPERVISOR' | 'SELLER';

export async function authUserMySql(
  email: string,
  password: string,
): Promise<{ id: string; name: string; role: Role; email: string; mustChangePassword: boolean } | null> {
  const e = String(email ?? '').trim().toLowerCase();
  if (!e) return null;

  const pool = getMySqlPool();
  const [rows] = await pool.query<any[]>(
    'SELECT id, name, email, password_hash, role, must_change_password FROM users WHERE email = ? LIMIT 1',
    [e],
  );

  const row = rows?.[0];
  if (!row) return null;

  const ok = bcrypt.compareSync(String(password ?? ''), String(row.password_hash ?? ''));
  if (!ok) return null;

  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    role: row.role as Role,
    mustChangePassword: Number(row.must_change_password ?? 0) === 1,
  };
}