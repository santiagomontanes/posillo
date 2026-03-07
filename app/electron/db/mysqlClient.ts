import mysql from 'mysql2/promise';
import { readMySqlConfig } from './mysqlConfig';

let pool: mysql.Pool | null = null;

export const getMySqlPool = (): mysql.Pool => {
  if (pool) return pool;

  const cfg = readMySqlConfig();
  if (!cfg?.host || !cfg?.user || !cfg?.database) {
    throw new Error('MySQL no configurado');
  }

  pool = mysql.createPool({
    host: cfg.host,
    port: cfg.port ?? 3306,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    waitForConnections: true,
    connectionLimit: 10,
    enableKeepAlive: true,
  });

  return pool;
};

export const mysqlQuery = async <T = any>(sql: string, params: any[] = []): Promise<T[]> => {
  const p = getMySqlPool();
  const [rows] = await p.query(sql, params);
  return rows as T[];
};

export const mysqlExec = async (sql: string, params: any[] = []) => {
  const p = getMySqlPool();
  const [res] = await p.execute(sql, params);
  return res;
};