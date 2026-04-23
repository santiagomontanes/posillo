import { v4 as uuid } from 'uuid';
import { getDb, getDbMode } from './db';
import {
  closeTableOrderMySql,
  createTableOrderMySql,
  getTableOrderMySql,
  listOpenTableOrdersMySql,
  saveTableOrderMySql,
  type TableOrderItemInput,
} from './mysql/tableOrders.mysql';

const ensureTableOrdersSchemaSqlite = (): void => {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS table_orders (
      id TEXT PRIMARY KEY,
      table_name TEXT NOT NULL,
      total INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS table_order_items (
      id TEXT PRIMARY KEY,
      table_order_id TEXT NOT NULL,
      product_id TEXT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      qty INTEGER NOT NULL DEFAULT 0,
      unit_price INTEGER NOT NULL DEFAULT 0,
      line_total INTEGER NOT NULL DEFAULT 0,
      stock INTEGER,
      unit_cost REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (table_order_id) REFERENCES table_orders(id)
    );

    CREATE INDEX IF NOT EXISTS idx_table_orders_status ON table_orders(status);
    CREATE INDEX IF NOT EXISTS idx_table_orders_created_at ON table_orders(created_at);
    CREATE INDEX IF NOT EXISTS idx_table_order_items_table ON table_order_items(table_order_id);
  `);
};

const listOpenTableOrdersSqlite = (): any[] => {
  ensureTableOrdersSchemaSqlite();

  return getDb()
    .prepare(`
      SELECT
        t.id,
        t.table_name,
        t.total,
        t.status,
        t.created_at,
        COUNT(i.id) as item_count
      FROM table_orders t
      LEFT JOIN table_order_items i ON i.table_order_id = t.id
      WHERE t.status = 'open'
      GROUP BY t.id, t.table_name, t.total, t.status, t.created_at
      ORDER BY t.created_at DESC
    `)
    .all();
};

const createTableOrderSqlite = (tableName: string): string => {
  ensureTableOrdersSchemaSqlite();

  const id = uuid();
  const now = new Date().toISOString();

  getDb()
    .prepare(`
      INSERT INTO table_orders (id, table_name, total, status, created_at, updated_at)
      VALUES (?, ?, 0, 'open', ?, ?)
    `)
    .run(id, tableName, now, now);

  return id;
};

const getTableOrderSqlite = (id: string): any | null => {
  ensureTableOrdersSchemaSqlite();

  const db = getDb();
  const table = db
    .prepare(`
      SELECT id, table_name, total, status, created_at
      FROM table_orders
      WHERE id = ?
      LIMIT 1
    `)
    .get(id) as any;

  if (!table) return null;

  const items = db
    .prepare(`
      SELECT *
      FROM table_order_items
      WHERE table_order_id = ?
      ORDER BY created_at ASC, id ASC
    `)
    .all(id);

  return {
    id: table.id,
    tableName: table.table_name,
    total: Number(table.total ?? 0),
    status: table.status,
    createdAt: table.created_at,
    items,
  };
};

const saveTableOrderSqlite = (input: {
  id: string;
  tableName?: string;
  items: TableOrderItemInput[];
  total: number;
}): void => {
  ensureTableOrdersSchemaSqlite();

  const db = getDb();
  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE table_orders
      SET table_name = COALESCE(?, table_name),
          total = ?,
          updated_at = ?
      WHERE id = ?
        AND status = 'open'
    `).run(
      input.tableName ? String(input.tableName).trim() : null,
      Number(input.total ?? 0),
      now,
      input.id,
    );

    db.prepare(`DELETE FROM table_order_items WHERE table_order_id = ?`).run(input.id);

    for (const item of input.items ?? []) {
      db.prepare(`
        INSERT INTO table_order_items
          (id, table_order_id, product_id, name, description, qty, unit_price, line_total, stock, unit_cost, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        uuid(),
        input.id,
        item.product_id ?? null,
        String(item.name ?? 'Producto'),
        String(item.description ?? ''),
        Number(item.qty ?? 0),
        Number(item.unit_price ?? 0),
        Number(item.line_total ?? 0),
        item.stock == null ? null : Number(item.stock),
        Number(item.unit_cost ?? 0),
        now,
      );
    }
  });

  tx();
};

const closeTableOrderSqlite = (id: string): void => {
  ensureTableOrdersSchemaSqlite();

  const db = getDb();
  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM table_order_items WHERE table_order_id = ?`).run(id);
    db.prepare(`
      UPDATE table_orders
      SET status = 'closed',
          total = 0,
          updated_at = ?
      WHERE id = ?
    `).run(now, id);
  });

  tx();
};

export const listOpenTableOrdersRepo = async (): Promise<any[]> => {
  const mode = await getDbMode();
  return mode === 'mysql' ? await listOpenTableOrdersMySql() : listOpenTableOrdersSqlite();
};

export const createTableOrderRepo = async (tableName: string): Promise<string> => {
  const mode = await getDbMode();
  return mode === 'mysql' ? await createTableOrderMySql(tableName) : createTableOrderSqlite(tableName);
};

export const getTableOrderRepo = async (id: string): Promise<any | null> => {
  const mode = await getDbMode();
  return mode === 'mysql' ? await getTableOrderMySql(id) : getTableOrderSqlite(id);
};

export const saveTableOrderRepo = async (input: {
  id: string;
  tableName?: string;
  items: TableOrderItemInput[];
  total: number;
}): Promise<void> => {
  const mode = await getDbMode();
  if (mode === 'mysql') {
    await saveTableOrderMySql(input);
    return;
  }
  saveTableOrderSqlite(input);
};

export const closeTableOrderRepo = async (id: string): Promise<void> => {
  const mode = await getDbMode();
  if (mode === 'mysql') {
    await closeTableOrderMySql(id);
    return;
  }
  closeTableOrderSqlite(id);
};
