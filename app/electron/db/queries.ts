// app/electron/db/queries.ts
import { v4 as uuid } from 'uuid';
import bcrypt from 'bcryptjs';
import { getDb, getDbMode } from './db';
import { mysqlQueryOne } from './mysql';


export const reportDailyClose = (from: string, to: string) => {
  const db = getDb();

  // Total ventas por método
  const totalsByMethodRows = db
    .prepare(
      `SELECT payment_method, SUM(total) as total
       FROM sales
       WHERE date BETWEEN ? AND ?
       GROUP BY payment_method`,
    )
    .all(from, to) as Array<{ payment_method: string; total: number }>;

  const totalsByMethod: Record<string, number> = {};
  let totalSales = 0;

  for (const r of totalsByMethodRows) {
    const pm = String(r.payment_method ?? 'OTRO');
    const t = Number(r.total ?? 0);
    totalsByMethod[pm] = (totalsByMethod[pm] ?? 0) + t;
    totalSales += t;
  }

  // Utilidad: sum(line_total - unit_cost*qty) solo items con producto
  const prow = db
    .prepare(
      `SELECT SUM(si.line_total - (si.unit_cost * si.qty)) as profit
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       WHERE s.date BETWEEN ? AND ?
         AND si.product_id IS NOT NULL`,
    )
    .get(from, to) as { profit?: number } | undefined;

  const profit = Number(prow?.profit ?? 0);

  return {
    from,
    to,
    totalSales,
    profit,
    totalsByMethod,
  };
};


export function changeUserPassword(input: {
  id: string;
  currentPassword: string | null;
  newPassword: string;
}): void {
  const db = getDb();

  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(input.id) as any;
  if (!row) throw new Error('Usuario no existe');

  if (input.currentPassword != null) {
    const ok = bcrypt.compareSync(String(input.currentPassword), String(row.password_hash ?? ''));
    if (!ok) throw new Error('Contraseña actual incorrecta');
  }

  const newHash = bcrypt.hashSync(input.newPassword, 10);

  // si tienes columna must_change_password:
  db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?')
    .run(newHash, input.id);
}

export type Role = 'ADMIN' | 'SUPERVISOR' | 'SELLER';

export type AuditLogAction =
  | 'USER_CREATE'
  | 'USER_RESET_PASSWORD'
  | 'SALE_CREATE'
  | 'SALE_VOID'
  | 'CASH_OPEN'
  | 'CASH_CLOSE'
  | 'PRODUCT_SAVE'
  | 'PRODUCT_UPDATE'
  | 'PRODUCT_DELETE'
  | 'BACKUP_CREATE'
  | 'EXPENSE_CREATE'
  | 'USER_CHANGE_PASSWORD';

export type AuditEntityType = 'USER' | 'SALE' | 'CASH_SESSION' | 'PRODUCT' | 'BACKUP'| 'EXPENSE';

const ensureAuditSchema = (): void => {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role in ('ADMIN','SUPERVISOR','SELLER')),
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
  `);
};

export const logAudit = (input: {
  actorId: string;
  action: AuditLogAction;
  entityType: AuditEntityType;
  entityId?: string | null;
  metadata?: unknown;
}): string => {
  ensureAuditSchema();
  const db = getDb();
  const actor = db.prepare('SELECT id FROM users WHERE id = ?').get(input.actorId) as { id: string } | undefined;
  if (!actor) return '';

  const id = uuid();
  db.prepare('INSERT INTO audit_logs (id,actor_user_id,action,entity_type,entity_id,metadata,created_at) VALUES (?,?,?,?,?,?,?)').run(
    id,
    input.actorId,
    input.action,
    input.entityType,
    input.entityId ?? null,
    input.metadata == null ? null : JSON.stringify(input.metadata),
    new Date().toISOString(),
  );
  return id;
};

export const listAuditLogs = (filters: {
  from: string;
  to: string;
  actorId?: string;
  action?: string;
  limit?: number;
  offset?: number;
}): unknown[] => {
  const params: unknown[] = [filters.from, filters.to];
  const where: string[] = ['al.created_at BETWEEN ? AND ?'];
  if (filters.actorId) {
    where.push('al.actor_user_id = ?');
    params.push(filters.actorId);
  }
  if (filters.action) {
    where.push('al.action = ?');
    params.push(filters.action);
  }
  params.push(Math.max(1, Math.min(Number(filters.limit ?? 100), 500)));
  params.push(Math.max(0, Number(filters.offset ?? 0)));

  return getDb()
    .prepare(
      `SELECT al.id, al.created_at, al.actor_user_id, u.name as actor_name, u.email as actor_email,
              al.action, al.entity_type, al.entity_id, al.metadata
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.actor_user_id
       WHERE ${where.join(' AND ')}
       ORDER BY al.created_at DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params);
};

/**
 * ✅ AUTH ONLINE/OFFLINE
 * - Si DB MODE = MYSQL => valida contra la tabla users en MySQL
 * - Si DB MODE = SQLITE => valida contra users en SQLite local
 */
export const authUser = async (
  email: string,
  password: string,
): Promise<{ id: string; name: string; role: Role; email: string } | null> => {
  const cleanEmail = String(email ?? '').trim().toLowerCase();
  if (!cleanEmail) return null;

  const mode = await getDbMode();

  // ===== MYSQL =====
  if (mode === 'mysql') {
    const row = await mysqlQueryOne<{
      id: string;
      name: string;
      email: string;
      password_hash: string;
      role: Role;
    }>(
      `SELECT id, name, email, password_hash, role
       FROM users
       WHERE email = ?
       LIMIT 1`,
      [cleanEmail],
    );

    if (!row) return null;
    if (!bcrypt.compareSync(password, row.password_hash)) return null;

    return { id: row.id, name: row.name, role: row.role, email: row.email };
  }

  // ===== SQLITE =====
  const row = getDb().prepare('SELECT id,name,email,password_hash,role FROM users WHERE email = ?').get(cleanEmail) as
    | { id: string; name: string; email: string; password_hash: string; role: Role }
    | undefined;

  if (!row || !bcrypt.compareSync(password, row.password_hash)) return null;
  return { id: row.id, name: row.name, role: row.role, email: row.email };
};

export const listUsers = (): unknown[] =>
  getDb().prepare('SELECT id,name,email,role,created_at FROM users ORDER BY created_at DESC').all();

export const listUsersBasic = (): unknown[] =>
  getDb().prepare('SELECT id,name,email,role FROM users ORDER BY name ASC').all();

export const createUser = (payload: { name: string; email: string; password: string; role: Role }): string => {
  const email = String(payload.email ?? '').trim().toLowerCase();
  if (!email) throw new Error('Email requerido');

  const exists = getDb().prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: string } | undefined;
  if (exists) throw new Error('El email ya existe');

  const id = uuid();
  const hash = bcrypt.hashSync(payload.password, 10);
  getDb().prepare('INSERT INTO users (id,name,email,password_hash,role,created_at) VALUES (?,?,?,?,?,?)').run(
    id,
    String(payload.name ?? '').trim(),
    email,
    hash,
    payload.role,
    new Date().toISOString(),
  );
  return id;
};

export const resetUserPassword = (payload: { id: string; newPassword: string }): void => {
  if (!payload?.id) throw new Error('Missing user id');
  const hash = bcrypt.hashSync(payload.newPassword, 10);
  const result = getDb().prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, payload.id);
  if (!result.changes) throw new Error('User not updated');
};

export const listProducts = (search = ''): unknown[] => {
  const q = `%${search}%`;
  return getDb()
    .prepare('SELECT * FROM products WHERE active = 1 AND (brand LIKE ? OR model LIKE ? OR cpu LIKE ?) ORDER BY created_at DESC')
    .all(q, q, q);
};

export const listPosProducts = (search = ''): unknown[] => {
  const q = `%${search}%`;
  return getDb()
    .prepare(
      'SELECT id,brand,model,cpu,ram_gb,storage,sale_price,stock FROM products WHERE active = 1 AND (brand LIKE ? OR model LIKE ? OR cpu LIKE ?) ORDER BY created_at DESC',
    )
    .all(q, q, q);
};

export const upsertProduct = (payload: any): string => {
  const now = new Date().toISOString();
  const id = payload.id ?? uuid();
  const existing = getDb().prepare('SELECT id FROM products WHERE id = ?').get(id);
  if (existing) {
    updateProduct({ ...payload, id });
  } else {
    getDb()
      .prepare(
        `INSERT INTO products (id,brand,model,cpu,ram_gb,storage,condition,purchase_price,sale_price,stock,notes,active,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        id,
        payload.brand,
        payload.model,
        payload.cpu,
        payload.ram_gb,
        payload.storage,
        payload.condition,
        payload.purchase_price,
        payload.sale_price,
        payload.stock,
        payload.notes ?? '',
        1,
        now,
        now,
      );
  }
  return id;
};

export const updateProduct = (payload: any): unknown => {
  if (!payload?.id) throw new Error('Missing product id');

  const now = new Date().toISOString();
  const result = getDb()
    .prepare(
      `UPDATE products SET brand=?,model=?,cpu=?,ram_gb=?,storage=?,condition=?,purchase_price=?,sale_price=?,stock=?,notes=?,updated_at=? WHERE id=?`,
    )
    .run(
      payload.brand,
      payload.model,
      payload.cpu,
      payload.ram_gb,
      payload.storage,
      payload.condition,
      payload.purchase_price,
      payload.sale_price,
      payload.stock,
      payload.notes ?? '',
      now,
      payload.id,
    );

  if (!result.changes) throw new Error('Product not updated');

  return getDb().prepare('SELECT * FROM products WHERE id = ?').get(payload.id);
};

export const archiveProduct = (id: string): void => {
  getDb().prepare('UPDATE products SET active = 0, updated_at = ? WHERE id = ?').run(new Date().toISOString(), id);
};

export const nextInvoiceNumber = (): string => {
  const year = new Date().getFullYear();
  const pref = `ST-${year}-`;
  const row = getDb()
    .prepare('SELECT invoice_number FROM sales WHERE invoice_number LIKE ? ORDER BY invoice_number DESC LIMIT 1')
    .get(`${pref}%`) as { invoice_number?: string } | undefined;
  const n = row?.invoice_number ? Number(row.invoice_number.split('-')[2]) + 1 : 1;
  return `${pref}${String(n).padStart(6, '0')}`;
};

export const createSale = (input: any): { saleId: string; invoiceNumber: string } => {
  const db = getDb();
  const saleId = uuid();
  const invoiceNumber = nextInvoiceNumber();
  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO sales (id,invoice_number,date,user_id,payment_method,subtotal,discount,total,customer_name,customer_id,created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      saleId,
      invoiceNumber,
      now,
      input.userId,
      input.paymentMethod,
      input.subtotal,
      input.discount,
      input.total,
      input.customerName ?? '',
      input.customerId ?? '',
      now,
    );

    for (const item of input.items) {
      const isFreeItem = item.product_id == null;
      if (isFreeItem) {
        const description = String(item.description ?? '').trim();
        if (!description) throw new Error('Descripción requerida para ítem libre.');
        const unitCost = Math.max(0, Number(item.unit_cost ?? 0));
        if (item.unit_price < 0 || item.qty < 1 || unitCost < 0) throw new Error('Valores inválidos para ítem libre.');
        db.prepare('INSERT INTO sale_items (id,sale_id,product_id,qty,unit_price,line_total,description,unit_cost) VALUES (?,?,?,?,?,?,?,?)').run(
          uuid(),
          saleId,
          null,
          item.qty,
          item.unit_price,
          item.line_total,
          description,
          unitCost,
        );
        continue;
      }

      const product = db.prepare('SELECT stock, purchase_price FROM products WHERE id=?').get(item.product_id) as
        | { stock: number; purchase_price: number }
        | undefined;
      if (!product || item.qty > product.stock) {
        throw new Error('Stock insuficiente para uno de los productos.');
      }
      db.prepare('INSERT INTO sale_items (id,sale_id,product_id,qty,unit_price,line_total,description,unit_cost) VALUES (?,?,?,?,?,?,?,?)').run(
        uuid(),
        saleId,
        item.product_id,
        item.qty,
        item.unit_price,
        item.line_total,
        String(item.description ?? ''),
        Number(product?.purchase_price ?? 0),
      );
      db.prepare('UPDATE products SET stock = stock - ?, updated_at = ? WHERE id = ?').run(item.qty, now, item.product_id);
    }
  });

  tx();
  return { saleId, invoiceNumber };
};

export const addExpense = (data: any): string => {
  const id = uuid();
  const now = new Date().toISOString();
  getDb().prepare('INSERT INTO expenses (id,date,concept,amount,notes,created_at) VALUES (?,?,?,?,?,?)').run(
    id,
    data.date,
    data.concept,
    data.amount,
    data.notes ?? '',
    now,
  );
  return id;
};

export const listExpenses = (from: string, to: string): unknown[] =>
  getDb().prepare('SELECT * FROM expenses WHERE date BETWEEN ? AND ? ORDER BY date DESC').all(from, to);

export const getLastCashClosure = (): unknown =>
  getDb().prepare('SELECT * FROM cash_closures WHERE closed_at IS NOT NULL ORDER BY closed_at DESC LIMIT 1').get();

export const getOpenSuggestion = (): unknown => {
  const last = getLastCashClosure() as any;
  if (!last) return { suggestedOpeningCash: null, lastClosedAt: null };
  return {
    suggestedOpeningCash: last.counted_cash ?? null,
    lastClosedAt: last.closed_at ?? null,
  };
};

export const openCash = (data: { userId: string; openingCash: number; openingNotes?: string }): string => {
  const id = uuid();
  getDb().prepare('INSERT INTO cash_closures (id,opened_at,opened_by,opening_cash,opening_notes) VALUES (?,?,?,?,?)').run(
    id,
    new Date().toISOString(),
    data.userId,
    data.openingCash,
    data.openingNotes ?? '',
  );
  return id;
};

export const getOpenCash = (): unknown =>
  getDb().prepare('SELECT * FROM cash_closures WHERE closed_at IS NULL ORDER BY opened_at DESC LIMIT 1').get();

export const getCashStatus = (): unknown => {
  const db = getDb();
  const open = db.prepare('SELECT * FROM cash_closures WHERE closed_at IS NULL ORDER BY opened_at DESC LIMIT 1').get() as any;
  if (!open) return null;

  const now = new Date().toISOString();
  const cashSales = (db
    .prepare('SELECT COALESCE(SUM(total),0) as total FROM sales WHERE date BETWEEN ? AND ? AND payment_method = ?')
    .get(open.opened_at, now, 'EFECTIVO') as any).total;
  const expenses = (db.prepare('SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE date BETWEEN ? AND ?').get(open.opened_at, now) as any).total;
  const expectedCash = open.opening_cash + cashSales - expenses;

  return {
    openedAt: open.opened_at,
    openingCash: open.opening_cash,
    cashSales,
    expenses,
    expectedCash,
  };
};

export const closeCash = (data: { id: string; countedCash: number; userId: string; notes: string }): unknown => {
  const db = getDb();
  const cash = db.prepare('SELECT * FROM cash_closures WHERE id = ?').get(data.id) as any;
  const closedAt = new Date().toISOString();
  const sales = (db
    .prepare(
      'SELECT COALESCE(SUM(total),0) as total, COALESCE(SUM(CASE WHEN payment_method = ? THEN total ELSE 0 END),0) as cashSales FROM sales WHERE date BETWEEN ? AND ?',
    )
    .get('EFECTIVO', cash.opened_at, closedAt) as any);
  const expenses = (db.prepare('SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE date BETWEEN ? AND ?').get(cash.opened_at, closedAt) as any).total;
  const expectedCash = cash.opening_cash + sales.cashSales - expenses;
  const diff = data.countedCash - expectedCash;
  db.prepare(
    'UPDATE cash_closures SET closed_at=?,closed_by=?,counted_cash=?,expected_cash=?,total_sales=?,total_expenses=?,difference=?,notes=? WHERE id=?',
  ).run(closedAt, data.userId, data.countedCash, expectedCash, sales.total, expenses, diff, data.notes, data.id);
  return { closedAt, expectedCash, totalSales: sales.total, totalExpenses: expenses, diff };
};

export const getTodaySummary = (): unknown => {
  const db = getDb();
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();

  return db
    .prepare(
      `SELECT
        (SELECT COALESCE(SUM(total),0) FROM sales WHERE date BETWEEN ? AND ?) as total_sales,
        (SELECT COALESCE(SUM(total),0) FROM sales WHERE date BETWEEN ? AND ? AND payment_method = ?) as cash_sales,
        (SELECT COALESCE(SUM(amount),0) FROM expenses WHERE date BETWEEN ? AND ?) as total_expenses,
        (SELECT COALESCE(SUM(si.qty * COALESCE(si.unit_cost, p.purchase_price, 0)),0)
          FROM sale_items si
          JOIN sales s ON s.id = si.sale_id
          LEFT JOIN products p ON p.id = si.product_id
          WHERE s.date BETWEEN ? AND ?) as total_costs`,
    )
    .get(start, end, start, end, 'EFECTIVO', start, end, start, end);
};

export const getLast7DaysSales = (): unknown[] => {
  const now = new Date();
  const from = new Date(now);
  from.setDate(now.getDate() - 6);
  from.setHours(0, 0, 0, 0);
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);

  return getDb()
    .prepare('SELECT substr(date,1,10) as day, COALESCE(SUM(total),0) as total FROM sales WHERE date BETWEEN ? AND ? GROUP BY day ORDER BY day')
    .all(from.toISOString(), to.toISOString());
};

export const reportSalesByDay = (from: string, to: string): unknown[] =>
  getDb().prepare('SELECT substr(date,1,10) as day, SUM(total) as total FROM sales WHERE date BETWEEN ? AND ? GROUP BY day ORDER BY day').all(from, to);

export const reportTopProducts = (from: string, to: string): unknown[] =>
  getDb()
    .prepare(
      `SELECT
         COALESCE(
           NULLIF(TRIM(COALESCE(p.name,'')), ''),
           NULLIF(TRIM(COALESCE(p.brand,'') || ' ' || COALESCE(p.model,'')), ''),
           'Producto'
         ) AS name,
         SUM(si.qty) AS qty
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       LEFT JOIN products p ON p.id = si.product_id
       WHERE s.date BETWEEN ? AND ?
         AND si.product_id IS NOT NULL
       GROUP BY si.product_id, name
       ORDER BY qty DESC
       LIMIT 10`,
    )
    .all(from, to);
export const reportSummary = (from: string, to: string): unknown =>
  getDb()
    .prepare(
      `SELECT
        (SELECT COALESCE(SUM(total),0) FROM sales WHERE date BETWEEN ? AND ?) as total_sales,
        (SELECT COALESCE(SUM(amount),0) FROM expenses WHERE date BETWEEN ? AND ?) as total_expenses,
        (SELECT COALESCE(SUM(si.qty * COALESCE(si.unit_cost, p.purchase_price, 0)),0)
          FROM sale_items si
          JOIN sales s ON s.id = si.sale_id
          LEFT JOIN products p ON p.id = si.product_id
          WHERE s.date BETWEEN ? AND ?) as total_costs`,
    )
    .get(from, to, from, to, from, to);