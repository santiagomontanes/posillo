import type Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';

function tableExists(db: Database.Database, name: string): boolean {
  const row = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?")
    .get(name);
  return !!row;
}

function viewExists(db: Database.Database, name: string): boolean {
  const row = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type='view' AND name=?")
    .get(name);
  return !!row;
}

function getTableColumns(db: Database.Database, table: string): string[] {
  try {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    return cols.map((c) => c.name);
  } catch {
    return [];
  }
}

export const runMigrations = (db: Database.Database): void => {
  // =========================
  // BASE TABLES
  // =========================
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role in ('ADMIN','SUPERVISOR','SELLER')),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      brand TEXT NOT NULL,
      model TEXT NOT NULL,
      cpu TEXT NOT NULL,
      ram_gb INTEGER NOT NULL,
      storage TEXT NOT NULL,
      condition TEXT NOT NULL,
      purchase_price INTEGER NOT NULL,
      sale_price INTEGER NOT NULL,
      stock INTEGER NOT NULL,
      notes TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      invoice_number TEXT NOT NULL UNIQUE,
      date TEXT NOT NULL,
      user_id TEXT NOT NULL,
      payment_method TEXT NOT NULL,
      subtotal INTEGER NOT NULL,
      discount INTEGER NOT NULL,
      total INTEGER NOT NULL,
      customer_name TEXT,
      customer_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id TEXT PRIMARY KEY,
      sale_id TEXT NOT NULL,
      product_id TEXT,
      qty INTEGER NOT NULL,
      unit_price INTEGER NOT NULL,
      line_total INTEGER NOT NULL,
      description TEXT DEFAULT '',
      unit_cost REAL NOT NULL DEFAULT 0,
      FOREIGN KEY (sale_id) REFERENCES sales(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      concept TEXT NOT NULL,
      amount INTEGER NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (actor_user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS cash_closures (
      id TEXT PRIMARY KEY,
      opened_at TEXT NOT NULL,
      closed_at TEXT,
      opened_by TEXT NOT NULL,
      opening_notes TEXT,
      closed_by TEXT,
      opening_cash INTEGER NOT NULL,
      expected_cash INTEGER,
      counted_cash INTEGER,
      total_sales INTEGER,
      total_expenses INTEGER,
      difference INTEGER,
      notes TEXT
    );
  `);

  // =========================
  // SAFE USERS SCHEMA CHECK
  // =========================
  const userColsBefore = db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>;
  const usersSchema = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'")
    .get() as { sql?: string } | undefined;

  const usersHasSupervisor = usersSchema?.sql?.includes("'SUPERVISOR'") ?? false;
  const usersHasCreatedAt = userColsBefore.some((c) => c.name === 'created_at');

  // Si falta SUPERVISOR en CHECK o falta created_at, migrar users de forma segura
  if (!usersHasSupervisor || !usersHasCreatedAt) {
    const now = new Date().toISOString();

    db.exec('PRAGMA foreign_keys=OFF');

    // 1) Si existe VIEW users_old, borrarlo (FK no funciona con views)
    if (viewExists(db, 'users_old')) {
      db.exec('DROP VIEW IF EXISTS users_old');
    }

    // 2) Asegurar users_old como tabla temporal si hace falta renombrar
    const usersExists = tableExists(db, 'users');
    const usersOldExists = tableExists(db, 'users_old');

    if (usersExists && !usersOldExists) {
      db.exec('ALTER TABLE users RENAME TO users_old');
    }

    // 3) Crear tabla users final
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role in ('ADMIN','SUPERVISOR','SELLER')),
        created_at TEXT NOT NULL
      );
    `);

    // 4) Migrar desde users_old solo si existe
    if (tableExists(db, 'users_old')) {
      const oldCols = getTableColumns(db, 'users_old');
      const oldHasCreatedAt = oldCols.includes('created_at');

      if (oldHasCreatedAt) {
        db.exec(`
          INSERT OR IGNORE INTO users (id,name,email,password_hash,role,created_at)
          SELECT
            id,
            name,
            email,
            password_hash,
            role,
            COALESCE(NULLIF(created_at, ''), '${now}')
          FROM users_old;
        `);
      } else {
        db.exec(`
          INSERT OR IGNORE INTO users (id,name,email,password_hash,role,created_at)
          SELECT
            id,
            name,
            email,
            password_hash,
            role,
            '${now}'
          FROM users_old;
        `);
      }
    }

    db.exec('PRAGMA foreign_keys=ON');
  }

  // =========================
  // COMPAT MODE (NO CAMBIAR FUNCIONES):
  // Mantener users_old como TABLA REAL + sincronizada
  // Esto evita:
  // - "no such table: users_old"
  // - "foreign key mismatch ... audit_logs referencing users_old"
  // =========================
  db.exec('PRAGMA foreign_keys=OFF');

  // Si existe como VIEW, eliminarlo
  if (viewExists(db, 'users_old')) {
    db.exec('DROP VIEW IF EXISTS users_old');
  }

  // Si users_old no existe como tabla, crearla y copiar desde users
  if (!tableExists(db, 'users_old')) {
    db.exec(`
      CREATE TABLE users_old (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role in ('ADMIN','SUPERVISOR','SELLER')),
        created_at TEXT NOT NULL
      );

      INSERT OR IGNORE INTO users_old (id,name,email,password_hash,role,created_at)
      SELECT id,name,email,password_hash,role,created_at FROM users;
    `);
  } else {
    // Si existe, asegurar columnas mínimas (si tu users_old vieja era distinta, la “rellenamos”)
    const uoCols = getTableColumns(db, 'users_old');
    const missingCreatedAt = !uoCols.includes('created_at');

    // Si está muy vieja (sin created_at), la reconstruimos sin perder datos básicos
    if (missingCreatedAt) {
      const now = new Date().toISOString();
      db.exec(`
        ALTER TABLE users_old RENAME TO users_old_legacy;

        CREATE TABLE users_old (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role in ('ADMIN','SUPERVISOR','SELLER')),
          created_at TEXT NOT NULL
        );

        INSERT OR IGNORE INTO users_old (id,name,email,password_hash,role,created_at)
        SELECT
          id,
          name,
          email,
          password_hash,
          role,
          '${now}'
        FROM users_old_legacy;

        DROP TABLE users_old_legacy;
      `);
    }

    // Backfill por si users tiene nuevos usuarios
    db.exec(`
      INSERT OR IGNORE INTO users_old (id,name,email,password_hash,role,created_at)
      SELECT id,name,email,password_hash,role,created_at FROM users;
    `);
  }

  // Triggers: users -> users_old (sincronización)
  db.exec(`
    DROP TRIGGER IF EXISTS trg_users_to_users_old_insert;
    DROP TRIGGER IF EXISTS trg_users_to_users_old_update;
    DROP TRIGGER IF EXISTS trg_users_to_users_old_delete;

    CREATE TRIGGER trg_users_to_users_old_insert
    AFTER INSERT ON users
    BEGIN
      INSERT OR REPLACE INTO users_old (id,name,email,password_hash,role,created_at)
      VALUES (NEW.id, NEW.name, NEW.email, NEW.password_hash, NEW.role, NEW.created_at);
    END;

    CREATE TRIGGER trg_users_to_users_old_update
    AFTER UPDATE ON users
    BEGIN
      INSERT OR REPLACE INTO users_old (id,name,email,password_hash,role,created_at)
      VALUES (NEW.id, NEW.name, NEW.email, NEW.password_hash, NEW.role, NEW.created_at);
    END;

    CREATE TRIGGER trg_users_to_users_old_delete
    AFTER DELETE ON users
    BEGIN
      DELETE FROM users_old WHERE id = OLD.id;
    END;
  `);

  db.exec('PRAGMA foreign_keys=ON');

  // =========================
// PRODUCTS MIGRATION (universal + barcode)
// =========================
const productCols = db.prepare('PRAGMA table_info(products)').all() as Array<{ name: string }>;
const has = (col: string) => productCols.some((c) => c.name === col);

if (!has('active')) db.exec('ALTER TABLE products ADD COLUMN active INTEGER NOT NULL DEFAULT 1');

// ✅ Campos universales (no rompen tu modelo actual)
if (!has('name')) db.exec('ALTER TABLE products ADD COLUMN name TEXT');
if (!has('category')) db.exec('ALTER TABLE products ADD COLUMN category TEXT');
if (!has('sku')) db.exec('ALTER TABLE products ADD COLUMN sku TEXT');
if (!has('barcode')) db.exec('ALTER TABLE products ADD COLUMN barcode TEXT');
if (!has('unit')) db.exec("ALTER TABLE products ADD COLUMN unit TEXT DEFAULT 'UND'");
if (!has('min_stock')) db.exec('ALTER TABLE products ADD COLUMN min_stock INTEGER DEFAULT 0');
if (!has('status')) db.exec("ALTER TABLE products ADD COLUMN status TEXT DEFAULT 'ACTIVE'");
if (!has('location')) db.exec('ALTER TABLE products ADD COLUMN location TEXT');

// Índice para buscar rápido por código de barras
db.exec('CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode)');

  // =========================
  // SALE ITEMS MIGRATION
  // =========================
  const saleItemCols = db.prepare('PRAGMA table_info(sale_items)').all() as Array<{ name: string; notnull: number }>;
  const hasDescription = saleItemCols.some((c) => c.name === 'description');
  const hasUnitCost = saleItemCols.some((c) => c.name === 'unit_cost');
  const productIdCol = saleItemCols.find((c) => c.name === 'product_id');
  const needsNullableProductId = productIdCol?.notnull === 1;

  if (needsNullableProductId) {
    db.exec(`
      ALTER TABLE sale_items RENAME TO sale_items_old;
      CREATE TABLE sale_items (
        id TEXT PRIMARY KEY,
        sale_id TEXT NOT NULL,
        product_id TEXT,
        qty INTEGER NOT NULL,
        unit_price INTEGER NOT NULL,
        line_total INTEGER NOT NULL,
        description TEXT DEFAULT '',
        unit_cost REAL NOT NULL DEFAULT 0,
        FOREIGN KEY (sale_id) REFERENCES sales(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
      );
      INSERT INTO sale_items (id,sale_id,product_id,qty,unit_price,line_total,description,unit_cost)
      SELECT id,sale_id,product_id,qty,unit_price,line_total,'',0 FROM sale_items_old;
      DROP TABLE sale_items_old;
    `);
  } else {
    if (!hasDescription) db.exec("ALTER TABLE sale_items ADD COLUMN description TEXT DEFAULT ''");
    if (!hasUnitCost) db.exec('ALTER TABLE sale_items ADD COLUMN unit_cost REAL NOT NULL DEFAULT 0');
  }

  // =========================
  // CASH MIGRATION
  // =========================
  const cashCols = db.prepare('PRAGMA table_info(cash_closures)').all() as Array<{ name: string }>;
  if (!cashCols.some((c) => c.name === 'opening_notes')) {
    db.exec('ALTER TABLE cash_closures ADD COLUMN opening_notes TEXT');
  }
  if (!cashCols.some((c) => c.name === 'difference')) {
    db.exec('ALTER TABLE cash_closures ADD COLUMN difference INTEGER');
  }
};

export const seedDefaultAdmin = (db: Database.Database): void => {
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@sistetecni.com') as { id: string } | undefined;
  if (exists) return;

  const now = new Date().toISOString();
  const hash = bcrypt.hashSync('Admin123*', 10);

  db.prepare('INSERT INTO users (id,name,email,password_hash,role,created_at) VALUES (?,?,?,?,?,?)').run(
    uuid(),
    'Administrador',
    'admin@sistetecni.com',
    hash,
    'ADMIN',
    now,
  );
}; 
