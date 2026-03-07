import Database from 'better-sqlite3';
import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { runMigrations, seedDefaultAdmin } from './migrations';
import { testMySqlConnection } from './mysql';

let dbInstance: Database.Database | null = null;
let dbOverrideForTests: Database.Database | null = null;

type AppConfig = {
  userId?: string;
  role?: string;
  dbMode?: 'sqlite' | 'mysql';
  mysql?: {
    host?: string;
    user?: string;
    password?: string;
    database?: string;
    port?: number;
  };
};

const getConfigPath = (): string => path.join(app.getPath('userData'), 'config.json');

export const readAppConfig = (): AppConfig | null => {
  try {
    const p = getConfigPath();
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as AppConfig;
  } catch {
    return null;
  }
};

export const getDbPath = (): string => {
  const dir = path.join(app.getPath('userData'), 'data');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'sistetecni-pos.db');
};

export const setDbForTests = (db: Database.Database | null): void => {
  dbOverrideForTests = db;
};

export const closeDb = (): void => {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
};

const ensureCriticalTables = (db: Database.Database): void => {
  const critical = ['users', 'products', 'sales', 'audit_logs'];
  const missing = critical.filter((name) => {
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
      .get(name) as { name: string } | undefined;
    return !row;
  });
  if (missing.length > 0) runMigrations(db);
};

export const getDb = (): Database.Database => {
  if (dbOverrideForTests) return dbOverrideForTests;
  if (!dbInstance) {
    dbInstance = new Database(getDbPath());
    dbInstance.pragma('journal_mode = WAL');
    runMigrations(dbInstance);
    ensureCriticalTables(dbInstance);
    seedDefaultAdmin(dbInstance);
  }
  return dbInstance;
};

/**
 * Decide si trabajamos MYSQL o SQLITE.
 * - Si el usuario eligió dbMode=mysql y la config está completa => intenta conectar.
 * - Si no => SQLITE.
 */
let cachedMode: 'mysql' | 'sqlite' = 'sqlite';
let lastModeCheck = 0;

export const getDbMode = async (): Promise<'mysql' | 'sqlite'> => {
  const now = Date.now();
  if (now - lastModeCheck < 3000) return cachedMode; // cache 3s
  lastModeCheck = now;

  const cfg = readAppConfig();
  const desired = cfg?.dbMode ?? 'sqlite';

  // Si el usuario NO eligió mysql => no probamos nada
  if (desired !== 'mysql') {
    cachedMode = 'sqlite';
    return cachedMode;
  }

  // Validar config mínima
  const m = cfg?.mysql;
  if (!m?.host || !m?.user || !m?.password || !m?.database) {
    cachedMode = 'sqlite';
    return cachedMode;
  }

  // Probar conexión
  const t = await testMySqlConnection({
    host: m.host,
    user: m.user,
    password: m.password,
    database: m.database,
    port: m.port ?? 3306,
  });

  cachedMode = t.ok ? 'mysql' : 'sqlite';
  return cachedMode;
};