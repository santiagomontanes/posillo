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

    /* =========================
       NUEVO: VENTAS SUSPENDIDAS
    ========================= */
    CREATE TABLE IF NOT EXISTS suspended_sales (
      id TEXT PRIMARY KEY,
      temp_number TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL,
      customer_name TEXT,
      customer_id TEXT,
      subtotal INTEGER NOT NULL DEFAULT 0,
      discount INTEGER NOT NULL DEFAULT 0,
      total INTEGER NOT NULL DEFAULT 0,
      payment_method TEXT NOT NULL DEFAULT 'EFECTIVO',
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS suspended_sale_items (
      id TEXT PRIMARY KEY,
      suspended_sale_id TEXT NOT NULL,
      product_id TEXT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      qty INTEGER NOT NULL,
      unit_price INTEGER NOT NULL,
      line_total INTEGER NOT NULL,
      stock INTEGER,
      unit_cost REAL NOT NULL DEFAULT 0,
      FOREIGN KEY (suspended_sale_id) REFERENCES suspended_sales(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    /* =========================
       NUEVO: DEVOLUCIONES
    ========================= */
    CREATE TABLE IF NOT EXISTS sale_returns (
      id TEXT PRIMARY KEY,
      sale_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      reason TEXT,
      total_returned INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (sale_id) REFERENCES sales(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS sale_return_items (
      id TEXT PRIMARY KEY,
      return_id TEXT NOT NULL,
      sale_item_id TEXT NOT NULL,
      product_id TEXT,
      qty INTEGER NOT NULL,
      unit_price INTEGER NOT NULL,
      line_total INTEGER NOT NULL,
      description TEXT DEFAULT '',
      FOREIGN KEY (return_id) REFERENCES sale_returns(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    /* =========================
       NUEVO: PROVEEDORES
    ========================= */
    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      contact_name TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      notes TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    /* =========================
       NUEVO: COMPRAS
    ========================= */
    CREATE TABLE IF NOT EXISTS purchases (
      id TEXT PRIMARY KEY,
      supplier_id TEXT,
      user_id TEXT NOT NULL,
      invoice_ref TEXT,
      date TEXT NOT NULL,
      subtotal INTEGER NOT NULL DEFAULT 0,
      total INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS purchase_items (
      id TEXT PRIMARY KEY,
      purchase_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      qty INTEGER NOT NULL,
      unit_cost INTEGER NOT NULL,
      line_total INTEGER NOT NULL,
      FOREIGN KEY (purchase_id) REFERENCES purchases(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE INDEX IF NOT EXISTS idx_suspended_sales_created_at ON suspended_sales(created_at);
    CREATE INDEX IF NOT EXISTS idx_suspended_sale_items_sale ON suspended_sale_items(suspended_sale_id);
    CREATE INDEX IF NOT EXISTS idx_sale_returns_sale_id ON sale_returns(sale_id);
    CREATE INDEX IF NOT EXISTS idx_sale_return_items_return_id ON sale_return_items(return_id);
    CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);
    CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(date);
    CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id ON purchase_items(purchase_id);
  `);

  const userColsBefore = db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>;
  const usersSchema = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'")
    .get() as { sql?: string } | undefined;

  const usersHasSupervisor = usersSchema?.sql?.includes("'SUPERVISOR'") ?? false;
  const usersHasCreatedAt = userColsBefore.some((c) => c.name === 'created_at');

  if (!usersHasSupervisor || !usersHasCreatedAt) {
    const now = new Date().toISOString();

    db.exec('PRAGMA foreign_keys=OFF');

    if (viewExists(db, 'users_old')) {
      db.exec('DROP VIEW IF EXISTS users_old');
    }

    const usersExists = tableExists(db, 'users');
    const usersOldExists = tableExists(db, 'users_old');

    if (usersExists && !usersOldExists) {
      db.exec('ALTER TABLE users RENAME TO users_old');
    }

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

  db.exec('PRAGMA foreign_keys=OFF');

  if (viewExists(db, 'users_old')) {
    db.exec('DROP VIEW IF EXISTS users_old');
  }

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
    const uoCols = getTableColumns(db, 'users_old');
    const missingCreatedAt = !uoCols.includes('created_at');

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

    db.exec(`
      INSERT OR IGNORE INTO users_old (id,name,email,password_hash,role,created_at)
      SELECT id,name,email,password_hash,role,created_at FROM users;
    `);
  }

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

  const productCols = db.prepare('PRAGMA table_info(products)').all() as Array<{ name: string }>;
  const has = (col: string) => productCols.some((c) => c.name === col);

  if (!has('active')) db.exec('ALTER TABLE products ADD COLUMN active INTEGER NOT NULL DEFAULT 1');
  if (!has('name')) db.exec('ALTER TABLE products ADD COLUMN name TEXT');
  if (!has('category')) db.exec('ALTER TABLE products ADD COLUMN category TEXT');
  if (!has('sku')) db.exec('ALTER TABLE products ADD COLUMN sku TEXT');
  if (!has('barcode')) db.exec('ALTER TABLE products ADD COLUMN barcode TEXT');
  if (!has('unit')) db.exec("ALTER TABLE products ADD COLUMN unit TEXT DEFAULT 'UND'");
  if (!has('min_stock')) db.exec('ALTER TABLE products ADD COLUMN min_stock INTEGER DEFAULT 0');
  if (!has('status')) db.exec("ALTER TABLE products ADD COLUMN status TEXT DEFAULT 'ACTIVE'");
  if (!has('location')) db.exec('ALTER TABLE products ADD COLUMN location TEXT');

  db.exec('CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode)');

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