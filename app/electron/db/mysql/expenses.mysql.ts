import { v4 as uuid } from 'uuid';
import { getMySqlPool } from '../mysql';

function toStartOfDay(from: string): string {
  // si viene "YYYY-MM-DD" -> "YYYY-MM-DD 00:00:00"
  if (/^\d{4}-\d{2}-\d{2}$/.test(from)) return `${from} 00:00:00`;
  return from;
}

function toEndOfDay(to: string): string {
  // si viene "YYYY-MM-DD" -> "YYYY-MM-DD 23:59:59"
  if (/^\d{4}-\d{2}-\d{2}$/.test(to)) return `${to} 23:59:59`;
  return to;
}

export const addExpenseMySql = async (data: any): Promise<string> => {
  const pool = getMySqlPool();

  const id = uuid();
  const now = new Date();

  // si te mandan date, úsala; si no, usa now
  const date = data?.date ? new Date(String(data.date)) : now;

  await pool.execute(
    `INSERT INTO expenses (id, date, concept, amount, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      id,
      date, // mysql2 convierte Date -> DATETIME
      String(data?.concept ?? '').trim(),
      Number(data?.amount ?? 0),
      (data?.notes ?? null) ? String(data.notes) : null,
      now,
    ],
  );

  return id;
};

export const listExpensesMySql = async (from: string, to: string): Promise<any[]> => {
  const pool = getMySqlPool();

  const fromDt = toStartOfDay(String(from ?? '').trim());
  const toDt = toEndOfDay(String(to ?? '').trim());

  const [rows] = await pool.query(
    `SELECT id, date, concept, amount, notes, created_at
     FROM expenses
     WHERE date BETWEEN ? AND ?
     ORDER BY date DESC`,
    [fromDt, toDt],
  );

  return Array.isArray(rows) ? (rows as any[]) : [];
};