// app/electron/db/mysql.ts
import mysql, {
  type Pool,
  type PoolConnection,
  type RowDataPacket,
  type ResultSetHeader,
} from 'mysql2/promise';
import { readMySqlConfig, type MySqlConfig } from './mysqlConfig';

let pool: Pool | null = null;
let lastCfgKey: string | null = null;

const cfgKey = (c: MySqlConfig) => `${c.host}:${c.port ?? 3306}/${c.database}/${c.user}`;

export const getMySqlPool = (): Pool => {
  const cfg = readMySqlConfig();
  if (!cfg?.host || !cfg?.user || !cfg?.database) {
    throw new Error('MySQL no configurado');
  }

  const key = cfgKey(cfg);

  if (!pool || lastCfgKey !== key) {
    // cerrar pool anterior si cambió config
    if (pool) {
      pool.end().catch(() => {});
    }

    pool = mysql.createPool({
      host: cfg.host,
      port: cfg.port ?? 3306,
      user: cfg.user,
      password: cfg.password,
      database: cfg.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    });

    lastCfgKey = key;
  }

  return pool;
};

export const closeMySql = async (): Promise<void> => {
  if (!pool) return;
  try {
    await pool.end();
  } finally {
    pool = null;
    lastCfgKey = null;
  }
};

/**
 * Test de conexión:
 * - Si se pasa cfg => prueba con esa cfg (sin depender del config guardado)
 * - Si NO se pasa cfg => usa la cfg guardada en readMySqlConfig()
 */
export const testMySqlConnection = async (
  cfg?: MySqlConfig,
): Promise<{ ok: boolean; message?: string }> => {
  try {
    if (cfg) {
      const conn = await mysql.createConnection({
        host: cfg.host,
        port: cfg.port ?? 3306,
        user: cfg.user,
        password: cfg.password,
        database: cfg.database,
        connectTimeout: 3000,
      });
      await conn.ping();
      await conn.end();
      return { ok: true };
    }

    const p = getMySqlPool();
    const conn = await p.getConnection();
    await conn.ping();
    conn.release();
    return { ok: true };
  } catch (e: any) {
    return { ok: false, message: String(e?.message ?? e) };
  }
};

// ✅ SIEMPRE devuelve un array (nunca objeto/ResultSet raro)
export const mysqlQueryAll = async <T = RowDataPacket>(
  sql: string,
  params: any[] = [],
): Promise<T[]> => {
  const p = getMySqlPool();
  const [rows] = await p.query(sql, params);
  return Array.isArray(rows) ? (rows as T[]) : [];
};

export const mysqlQueryOne = async <T = RowDataPacket>(
  sql: string,
  params: any[] = [],
): Promise<T | null> => {
  const rows = await mysqlQueryAll<T>(sql, params);
  return rows[0] ?? null;
};

export const mysqlExec = async (
  sql: string,
  params: any[] = [],
): Promise<{ affectedRows: number; insertId?: any }> => {
  const p = getMySqlPool();
  const [res] = await p.execute<ResultSetHeader>(sql, params);
  return {
    affectedRows: Number(res.affectedRows ?? 0),
    insertId: (res as any).insertId,
  };
};

export const mysqlTx = async <T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> => {
  const p = getMySqlPool();
  const conn = await p.getConnection();
  try {
    await conn.beginTransaction();
    const out = await fn(conn);
    await conn.commit();
    return out;
  } catch (e) {
    try {
      await conn.rollback();
    } catch {}
    throw e;
  } finally {
    conn.release();
  }
};