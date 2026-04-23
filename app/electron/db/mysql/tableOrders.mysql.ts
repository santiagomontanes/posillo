import { v4 as uuid } from 'uuid';
import { getMySqlPool } from '../mysql';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toLocalMySqlDateTime(d = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

export type TableOrderItemInput = {
  product_id: string | null;
  name: string;
  description?: string;
  qty: number;
  unit_price: number;
  line_total: number;
  stock: number | null;
  unit_cost: number;
};

const ensureTableOrdersTablesMySql = async (): Promise<void> => {
  const pool = getMySqlPool();

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS table_orders (
      id VARCHAR(36) PRIMARY KEY,
      table_name VARCHAR(120) NOT NULL,
      total INT NOT NULL DEFAULT 0,
      status VARCHAR(20) NOT NULL DEFAULT 'open',
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      INDEX idx_table_orders_status (status),
      INDEX idx_table_orders_created_at (created_at)
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS table_order_items (
      id VARCHAR(36) PRIMARY KEY,
      table_order_id VARCHAR(36) NOT NULL,
      product_id VARCHAR(36) NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT NULL,
      qty INT NOT NULL DEFAULT 0,
      unit_price INT NOT NULL DEFAULT 0,
      line_total INT NOT NULL DEFAULT 0,
      stock INT NULL,
      unit_cost DOUBLE NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL,
      INDEX idx_table_order_items_table (table_order_id)
    )
  `);
};

export const listOpenTableOrdersMySql = async (): Promise<any[]> => {
  await ensureTableOrdersTablesMySql();

  const pool = getMySqlPool();
  const [rows] = await pool.query<any[]>(`
    SELECT
      t.id,
      t.table_name,
      t.total,
      t.status,
      t.created_at,
      COUNT(i.id) AS item_count
    FROM table_orders t
    LEFT JOIN table_order_items i ON i.table_order_id = t.id
    WHERE t.status = 'open'
    GROUP BY t.id, t.table_name, t.total, t.status, t.created_at
    ORDER BY t.created_at DESC
  `);

  return Array.isArray(rows) ? rows : [];
};

export const createTableOrderMySql = async (tableName: string): Promise<string> => {
  await ensureTableOrdersTablesMySql();

  const pool = getMySqlPool();
  const id = uuid();
  const now = toLocalMySqlDateTime(new Date());

  await pool.execute(
    `INSERT INTO table_orders (id, table_name, total, status, created_at, updated_at)
     VALUES (?, ?, 0, 'open', ?, ?)`,
    [id, tableName, now, now],
  );

  return id;
};

export const getTableOrderMySql = async (id: string): Promise<any | null> => {
  await ensureTableOrdersTablesMySql();

  const pool = getMySqlPool();
  const [tableRows] = await pool.query<any[]>(
    `SELECT id, table_name, total, status, created_at
     FROM table_orders
     WHERE id = ?
     LIMIT 1`,
    [id],
  );

  const row = tableRows?.[0];
  if (!row) return null;

  const [itemRows] = await pool.query<any[]>(
    `SELECT *
     FROM table_order_items
     WHERE table_order_id = ?
     ORDER BY created_at ASC, id ASC`,
    [id],
  );

  return {
    id: row.id,
    tableName: row.table_name,
    total: Number(row.total ?? 0),
    status: row.status,
    createdAt: row.created_at,
    items: Array.isArray(itemRows) ? itemRows : [],
  };
};

export const saveTableOrderMySql = async (input: {
  id: string;
  tableName?: string;
  items: TableOrderItemInput[];
  total: number;
}): Promise<void> => {
  await ensureTableOrdersTablesMySql();

  const pool = getMySqlPool();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const now = toLocalMySqlDateTime(new Date());

    await conn.execute(
      `UPDATE table_orders
       SET table_name = COALESCE(?, table_name),
           total = ?,
           updated_at = ?
       WHERE id = ?
         AND status = 'open'`,
      [
        input.tableName ? String(input.tableName).trim() : null,
        Number(input.total ?? 0),
        now,
        input.id,
      ],
    );

    await conn.execute(
      `DELETE FROM table_order_items WHERE table_order_id = ?`,
      [input.id],
    );

    for (const item of input.items ?? []) {
      await conn.execute(
        `INSERT INTO table_order_items
          (id, table_order_id, product_id, name, description, qty, unit_price, line_total, stock, unit_cost, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
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
        ],
      );
    }

    await conn.commit();
  } catch (error) {
    try {
      await conn.rollback();
    } catch {}
    throw error;
  } finally {
    conn.release();
  }
};

export const closeTableOrderMySql = async (id: string): Promise<void> => {
  await ensureTableOrdersTablesMySql();

  const pool = getMySqlPool();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    await conn.execute(
      `DELETE FROM table_order_items WHERE table_order_id = ?`,
      [id],
    );

    await conn.execute(
      `UPDATE table_orders
       SET status = 'closed',
           total = 0,
           updated_at = ?
       WHERE id = ?`,
      [toLocalMySqlDateTime(new Date()), id],
    );

    await conn.commit();
  } catch (error) {
    try {
      await conn.rollback();
    } catch {}
    throw error;
  } finally {
    conn.release();
  }
};
