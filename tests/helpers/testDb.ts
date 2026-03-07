import Database from 'better-sqlite3';
import { runMigrations } from '../../app/electron/db/migrations';
import { setDbForTests } from '../../app/electron/db/db';

export const setupTestDb = (): Database.Database => {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  setDbForTests(db);
  return db;
};

export const teardownTestDb = (db: Database.Database): void => {
  setDbForTests(null);
  db.close();
};

export const insertUser = (db: Database.Database, id = 'user-1'): void => {
  db.prepare('INSERT INTO users (id,name,email,password_hash,role,created_at) VALUES (?,?,?,?,?,?)').run(
    id,
    'Test User',
    `test-${id}@mail.com`,
    'hash',
    'ADMIN',
    '2025-01-01T00:00:00.000Z',
  );
};
