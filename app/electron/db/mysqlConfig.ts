import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

export type MySqlConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
};

type AppConfigFile = {
  dbMode?: 'sqlite' | 'mysql' | 'SQLITE' | 'MYSQL';
  mysql?: Partial<MySqlConfig>;
  // otros campos que ya tengas en config.json:
  userId?: string;
  role?: string;
  [k: string]: any;
};

const safeJsonParse = <T>(raw: string, fallback: T): T => {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

export const getAppConfigPath = (): string => {
  // %APPDATA%\sistetecni-pos-electron\config.json
  return path.join(app.getPath('userData'), 'config.json');
};

export const getMySqlConfigPath = (): string => {
  // Compatibilidad: %APPDATA%\sistetecni-pos-electron\mysql-config.json
  return path.join(app.getPath('userData'), 'mysql-config.json');
};

const normalizeMySql = (cfg: Partial<MySqlConfig> | undefined | null): MySqlConfig | null => {
  if (!cfg) return null;

  const host = (cfg.host ?? '').toString().trim();
  const user = (cfg.user ?? '').toString().trim();
  const database = (cfg.database ?? '').toString().trim();

  if (!host || !user || !database) return null;

  return {
    host,
    port: Number(cfg.port ?? 3306),
    user,
    password: (cfg.password ?? '').toString(),
    database,
  };
};

export const readMySqlConfig = (): MySqlConfig | null => {
  // 1) PRIORIDAD: leer desde config.json (porque tu UI guarda ahí)
  try {
    const p = getAppConfigPath();
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf-8');
      const appCfg = safeJsonParse<AppConfigFile>(raw, {});
      const fromApp = normalizeMySql(appCfg.mysql);
      if (fromApp) return fromApp;
    }
  } catch {
    // seguimos a fallback
  }

  // 2) FALLBACK: leer desde mysql-config.json (por compatibilidad)
  try {
    const p = getMySqlConfigPath();
    if (!fs.existsSync(p)) return null;
    const raw = fs.readFileSync(p, 'utf-8');
    const legacy = safeJsonParse<Partial<MySqlConfig>>(raw, {});
    return normalizeMySql(legacy);
  } catch {
    return null;
  }
};

export const writeMySqlConfig = (cfg: MySqlConfig): void => {
  // A) Guardar en config.json (FUENTE PRINCIPAL)
  const appPath = getAppConfigPath();
  const current: AppConfigFile = fs.existsSync(appPath)
    ? safeJsonParse<AppConfigFile>(fs.readFileSync(appPath, 'utf-8'), {})
    : {};

  const next: AppConfigFile = {
    ...current,
    dbMode: 'mysql',
    mysql: {
      host: cfg.host,
      port: cfg.port ?? 3306,
      user: cfg.user,
      password: cfg.password ?? '',
      database: cfg.database,
    },
  };

  fs.writeFileSync(appPath, JSON.stringify(next, null, 2), 'utf-8');

  // B) (Opcional) también guardar el legacy mysql-config.json para que nada se rompa
  const legacyPath = getMySqlConfigPath();
  fs.writeFileSync(legacyPath, JSON.stringify(cfg, null, 2), 'utf-8');
};

export const clearMySqlConfig = (): void => {
  // Limpia config.json + mysql-config.json
  try {
    const appPath = getAppConfigPath();
    if (fs.existsSync(appPath)) {
      const current = safeJsonParse<AppConfigFile>(fs.readFileSync(appPath, 'utf-8'), {});
      const next: AppConfigFile = { ...current, dbMode: 'sqlite' };
      delete next.mysql;
      fs.writeFileSync(appPath, JSON.stringify(next, null, 2), 'utf-8');
    }
  } catch {}

  try {
    const legacyPath = getMySqlConfigPath();
    if (fs.existsSync(legacyPath)) fs.unlinkSync(legacyPath);
  } catch {}
};