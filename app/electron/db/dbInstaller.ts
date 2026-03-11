import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import type { MySqlConfig } from './mysqlConfig';

export type InstallStep =
  | 'connecting'
  | 'creating_database'
  | 'creating_tables'
  | 'creating_siigo_tables'
  | 'creating_admin'
  | 'done'
  | 'error';

export type InstallProgress = {
  step: InstallStep;
  message: string;
  percent: number;
};

export type InstallOptions = {
  mysql: MySqlConfig;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  companyName?: string;
  onProgress?: (p: InstallProgress) => void;
};

export type InstallResult = {
  ok: boolean;
  error?: string;
};

const progress = (
  onProgress: ((p: InstallProgress) => void) | undefined,
  step: InstallStep,
  message: string,
  percent: number,
): void => {
  console.log(`[installer] ${percent}% — ${message}`);
  onProgress?.({ step, message, percent });
};

export const runInstaller = async (opts: InstallOptions): Promise<InstallResult> => {
  const { mysql: cfg, adminName, adminEmail, adminPassword, onProgress } = opts;

  let conn: mysql.Connection | null = null;

  try {
    progress(onProgress, 'connecting', `Conectando a ${cfg.host}:${cfg.port ?? 3306}...`, 5);

    conn = await mysql.createConnection({
      host: cfg.host,
      port: cfg.port ?? 3306,
      user: cfg.user,
      password: cfg.password,
      connectTimeout: 8000,
      multipleStatements: false,
    });

    progress(onProgress, 'connecting', 'Conexión establecida ✓', 10);

    progress(onProgress, 'creating_database', `Creando base de datos "${cfg.database}"...`, 15);

    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${cfg.database}\`
       CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );

    await conn.query(`USE \`${cfg.database}\``);

    progress(onProgress, 'creating_database', `Base de datos "${cfg.database}" lista ✓`, 20);

    progress(onProgress, 'creating_tables', 'Creando tablas del POS...', 25);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) NOT NULL,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL,
        created_at DATETIME NOT NULL,
        must_change_password TINYINT(1) NOT NULL DEFAULT 0,
        PRIMARY KEY (id),
        UNIQUE KEY email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    progress(onProgress, 'creating_tables', 'Tabla users ✓', 50);

    const email = adminEmail.trim().toLowerCase();
    const [existingRows] = await conn.query(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [email],
    );

    const existing = existingRows as any[];

    if (existing.length === 0) {
      const hash = bcrypt.hashSync(adminPassword, 10);
      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

      await conn.query(
        `INSERT INTO users (id, name, email, password_hash, role, created_at, must_change_password)
         VALUES (?, ?, ?, ?, 'ADMIN', ?, 0)`,
        [uuid(), adminName.trim(), email, hash, now],
      );

      progress(onProgress, 'creating_admin', `Administrador "${adminName}" creado ✓`, 90);
    } else {
      progress(onProgress, 'creating_admin', 'Usuario admin ya existe ✓', 90);
    }

    progress(onProgress, 'done', '¡Instalación completada exitosamente!', 100);

    return { ok: true };
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    console.error('[installer] Error:', msg);
    progress(onProgress, 'error', `Error: ${msg}`, 0);
    return { ok: false, error: msg };
  } finally {
    if (conn) {
      try {
        await conn.end();
      } catch {}
    }
  }
};

export const checkDbInstalled = async (
  cfg: MySqlConfig,
): Promise<{ installed: boolean; reason?: string }> => {
  let conn: mysql.Connection | null = null;

  try {
    conn = await mysql.createConnection({
      host: cfg.host,
      port: cfg.port ?? 3306,
      user: cfg.user,
      password: cfg.password,
      database: cfg.database,
      connectTimeout: 5000,
    });

    const [rows] = await conn.query(
      `
      SELECT COUNT(*) as total
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME IN ('users')
      `,
      [cfg.database],
    );

    const total = Number((rows as any[])[0]?.total ?? 0);

    return {
      installed: total >= 1,
      reason: total < 1 ? 'No existe la tabla users' : undefined,
    };
  } catch (e: any) {
    return { installed: false, reason: e?.message };
  } finally {
    if (conn) {
      try {
        await conn.end();
      } catch {}
    }
  }
};

export {};