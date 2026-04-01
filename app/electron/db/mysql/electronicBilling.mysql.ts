import { getMySqlPool } from '../mysql';
import { v4 as uuid } from 'uuid';

function now() {
  const d = new Date();
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

export async function getElectronicBillingSettingsMySql() {
  const pool = getMySqlPool();

  const [rows] = await pool.query<any[]>(
    `SELECT * FROM electronic_billing_settings LIMIT 1`
  );

  return rows?.[0] ?? null;
}

export async function upsertElectronicBillingSettingsMySql(data: {
  enabled: number;
  provider: string;
  environment: string;
  baseUrl: string;
  username?: string;
  password?: string;
  clientId?: string;
  clientSecret?: string;
}) {
  const pool = getMySqlPool();

  const existing = await getElectronicBillingSettingsMySql();

  if (!existing) {
    await pool.execute(
      `INSERT INTO electronic_billing_settings
      (id, enabled, provider, environment, base_url, username, password, client_id, client_secret, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuid(),
        data.enabled,
        data.provider,
        data.environment,
        data.baseUrl,
        data.username ?? null,
        data.password ?? null,
        data.clientId ?? null,
        data.clientSecret ?? null,
        now(),
        now(),
      ]
    );
    return;
  }

  await pool.execute(
    `UPDATE electronic_billing_settings SET
      enabled = ?,
      provider = ?,
      environment = ?,
      base_url = ?,
      username = ?,
      password = ?,
      client_id = ?,
      client_secret = ?,
      updated_at = ?
    WHERE id = ?`,
    [
      data.enabled,
      data.provider,
      data.environment,
      data.baseUrl,
      data.username ?? null,
      data.password ?? null,
      data.clientId ?? null,
      data.clientSecret ?? null,
      now(),
      existing.id,
    ]
  );
}