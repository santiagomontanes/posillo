import { v4 as uuid } from 'uuid';
import { getMySqlPool } from '../mysql';
import type { AuditEntityType, AuditLogAction } from '../audit.types';

export async function logAuditMySql(input: {
  actorId: string;
  action: AuditLogAction;
  entityType: AuditEntityType;
  entityId?: string | null;
  metadata?: unknown;
}): Promise<string> {
  const pool = getMySqlPool();
  const id = uuid();
  const createdAt = new Date().toISOString().slice(0, 19).replace('T', ' '); // 'YYYY-MM-DD HH:MM:SS'

  await pool.query(
    `INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      String(input.actorId),
      input.action,
      input.entityType,
      input.entityId ?? null,
      JSON.stringify(input.metadata ?? null),
      createdAt,
    ],
  );

  return id;
}

export async function listAuditLogsMySql(filters: {
  from: string;
  to: string;
  actorId?: string;
  action?: AuditLogAction;
  limit?: number;
  offset?: number;
}): Promise<any[]> {
  const pool = getMySqlPool();

  const fromRaw = String(filters.from ?? '').trim();
  const toRaw = String(filters.to ?? '').trim();

  // si vienen YYYY-MM-DD → expandir
  const fromDt = /^\d{4}-\d{2}-\d{2}$/.test(fromRaw) ? `${fromRaw} 00:00:00` : fromRaw;
  const toDt = /^\d{4}-\d{2}-\d{2}$/.test(toRaw) ? `${toRaw} 23:59:59` : toRaw;

  const where: string[] = [];
  const params: any[] = [];

  if (fromDt && toDt) {
    where.push(`al.created_at BETWEEN ? AND ?`);
    params.push(fromDt, toDt);
  }

  if (filters.actorId) {
    where.push(`al.actor_user_id = ?`);
    params.push(String(filters.actorId));
  }

  if (filters.action) {
    where.push(`al.action = ?`);
    params.push(String(filters.action));
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const limit = Math.max(1, Math.min(Number(filters.limit ?? 100), 500));
  const offset = Math.max(0, Number(filters.offset ?? 0));

  const [rows] = await pool.query(
    `
    SELECT
      al.id,
      al.created_at,
      al.actor_user_id,
      u.name as actor_name,
      u.email as actor_email,
      al.action,
      al.entity_type,
      al.entity_id,
      al.metadata
    FROM audit_logs al
    LEFT JOIN users u ON u.id = al.actor_user_id
    ${whereSql}
    ORDER BY al.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
    `,
    params,
  );

  return Array.isArray(rows) ? (rows as any[]) : [];
}