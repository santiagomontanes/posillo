import { v4 as uuid } from 'uuid';
import { getDbMode } from './db';
import { getDb } from './db';
import { mysqlExec, mysqlQueryAll, mysqlQueryOne } from './mysql';

export type ProductPayload = any;

const nowIso = () => new Date().toISOString();

// ----------------------
// Helpers
// ----------------------
const normalizeBarcode = (v: any): string => String(v ?? '').trim();

const toStr = (v: any): string => String(v ?? '').trim();
const toInt = (v: any, def = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
};

/**
 * ✅ Normaliza el payload para que JAMÁS haya undefined en SQL.
 * Importante porque tu schema legacy tiene columnas NOT NULL (brand, model, cpu, etc).
 */
const normalizeProductPayload = (payload: any) => {
  const p = payload ?? {};

  // ✅ Campos legacy (tu tabla original de laptops)
  // Si ahora tu inventario es "producto general", estos pueden venir vacíos.
  // Pero NO pueden ser undefined.
  const brand = toStr(p.brand);          // NOT NULL => '' permitido
  const model = toStr(p.model);          // NOT NULL => '' permitido
  const cpu = toStr(p.cpu);              // NOT NULL => '' permitido
  const ram_gb = toInt(p.ram_gb, 0);      // NOT NULL => 0
  const storage = toStr(p.storage);      // NOT NULL => ''
  const condition = toStr(p.condition) || 'N/A'; // NOT NULL => 'N/A' si viene vacío

  const purchase_price = toInt(p.purchase_price, 0);
  const sale_price = toInt(p.sale_price, 0);
  const stock = toInt(p.stock, 0);
  const notes = toStr(p.notes);          // nullable, pero mejor '' que undefined

  // ✅ Campos universales (opcionales)
  const name = p.name == null ? null : toStr(p.name);
  const category = p.category == null ? null : toStr(p.category);
  const sku = p.sku == null ? null : toStr(p.sku);
  const barcode = normalizeBarcode(p.barcode) || null;
  const unit = toStr(p.unit) || 'UND';
  const min_stock = toInt(p.min_stock, 0);
  const status = toStr(p.status) || 'ACTIVE';
  const location = p.location == null ? null : toStr(p.location);

  return {
    ...p,
    brand,
    model,
    cpu,
    ram_gb,
    storage,
    condition,
    purchase_price,
    sale_price,
    stock,
    notes,
    name,
    category,
    sku,
    barcode,
    unit,
    min_stock,
    status,
    location,
  };
};

// =====================
// SQLITE IMPLEMENTATION
// =====================
const sqlite_listProducts = (search = ''): any[] => {
  const q = `%${search}%`;
  return getDb()
    .prepare(
      `
      SELECT *
      FROM products
      WHERE active = 1
        AND (
          brand LIKE ? OR model LIKE ? OR cpu LIKE ?
          OR COALESCE(name,'') LIKE ?
          OR COALESCE(barcode,'') LIKE ?
          OR COALESCE(sku,'') LIKE ?
        )
      ORDER BY created_at DESC`,
    )
    .all(q, q, q, q, q, q);
};

const sqlite_listPosProducts = (search = ''): any[] => {
  const q = `%${search}%`;
  return getDb()
    .prepare(
      `
      SELECT id,brand,model,cpu,ram_gb,storage,sale_price,stock,name,barcode,sku
      FROM products
      WHERE active = 1
        AND (
          brand LIKE ? OR model LIKE ? OR cpu LIKE ?
          OR COALESCE(name,'') LIKE ?
          OR COALESCE(barcode,'') LIKE ?
          OR COALESCE(sku,'') LIKE ?
        )
      ORDER BY created_at DESC`,
    )
    .all(q, q, q, q, q, q);
};

const sqlite_getProductById = (id: string): any => {
  return getDb().prepare('SELECT * FROM products WHERE id = ?').get(id);
};

const sqlite_getProductByBarcode = (barcode: string): any => {
  const b = normalizeBarcode(barcode);
  if (!b) return null;
  return getDb()
    .prepare(
      `SELECT * FROM products
       WHERE active = 1
         AND COALESCE(barcode,'') = ?
         AND (status IS NULL OR status='ACTIVE')
       LIMIT 1`,
    )
    .get(b);
};

const sqlite_isBarcodeTaken = (barcode: string, excludeId?: string): boolean => {
  const b = normalizeBarcode(barcode);
  if (!b) return false;
  const row = getDb()
    .prepare(
      `SELECT id FROM products
       WHERE COALESCE(barcode,'') = ?
         AND active = 1
         AND (? IS NULL OR id <> ?)
       LIMIT 1`,
    )
    .get(b, excludeId ?? null, excludeId ?? null) as { id: string } | undefined;
  return !!row;
};

const nowSql = (): string => new Date().toISOString().slice(0, 19).replace('T', ' ');

const n = (v: any, def = 0) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : def;
};

const s = (v: any, def = '') => {
  const x = String(v ?? '').trim();
  return x ? x : def;
};

const sqlite_upsertProduct = (payload: any): string => {
  const now = nowSql();
  const id = s(payload?.id) || uuid();

  const p0 = normalizeProductPayload(payload);

  // ✅ Normaliza para evitar undefined/null raros
  const p = {
    brand: s(p0?.brand),
    model: s(p0?.model),
    cpu: s(p0?.cpu),
    ram_gb: n(p0?.ram_gb),
    storage: s(p0?.storage),
    condition: s(p0?.condition),
    purchase_price: n(p0?.purchase_price),
    sale_price: n(p0?.sale_price),
    stock: n(p0?.stock),
    notes: s(p0?.notes),
    name: s(p0?.name),
    category: s(p0?.category),
    sku: s(p0?.sku),
    barcode: s(p0?.barcode),
    unit: s(p0?.unit),
    min_stock: n(p0?.min_stock),
    status: s(p0?.status),
    location: s(p0?.location),
  };

  if (p.barcode && sqlite_isBarcodeTaken(p.barcode, id)) {
    throw new Error(`Ya existe un producto con ese código de barras: ${p.barcode}`);
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(id);

  if (existing) {
    const result = db
      .prepare(
        `UPDATE products
         SET brand=?, model=?, cpu=?, ram_gb=?, storage=?, condition=?,
             purchase_price=?, sale_price=?, stock=?, notes=?,
             name=?, category=?, sku=?, barcode=?, unit=?, min_stock=?, status=?, location=?,
             updated_at=?
         WHERE id=?`,
      )
      .run(
        p.brand,
        p.model,
        p.cpu,
        p.ram_gb,
        p.storage,
        p.condition,
        p.purchase_price,
        p.sale_price,
        p.stock,
        p.notes,
        p.name,
        p.category,
        p.sku,
        p.barcode,
        p.unit,
        p.min_stock,
        p.status,
        p.location,
        now,
        id,
      );

    if (!result.changes) throw new Error('Product not updated');
    return id;
  }

  db.prepare(
    `INSERT INTO products
      (id, brand, model, cpu, ram_gb, storage, condition, purchase_price, sale_price, stock, notes, active,
       name, category, sku, barcode, unit, min_stock, status, location,
       created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    id,
    p.brand,
    p.model,
    p.cpu,
    p.ram_gb,
    p.storage,
    p.condition,
    p.purchase_price,
    p.sale_price,
    p.stock,
    p.notes,
    1,
    p.name,
    p.category,
    p.sku,
    p.barcode,
    p.unit,
    p.min_stock,
    p.status,
    p.location,
    now,
    now,
  );

  return id;
};

const sqlite_archiveProduct = (id: string): void => {
  getDb().prepare('UPDATE products SET active = 0, updated_at = ? WHERE id = ?').run(nowIso(), id);
};

// ==================
// MYSQL IMPLEMENTATION
// ==================
const mysql_listProducts = async (search = ''): Promise<any[]> => {
  const q = `%${search}%`;
  return await mysqlQueryAll(
    `SELECT *
     FROM products
     WHERE active = 1
       AND (
         brand LIKE ? OR model LIKE ? OR cpu LIKE ?
         OR COALESCE(name,'') LIKE ?
         OR COALESCE(barcode,'') LIKE ?
         OR COALESCE(sku,'') LIKE ?
       )
     ORDER BY created_at DESC`,
    [q, q, q, q, q, q],
  );
};

const mysql_listPosProducts = async (search = ''): Promise<any[]> => {
  const q = `%${search}%`;
  return await mysqlQueryAll(
    `SELECT id,brand,model,cpu,ram_gb,storage,sale_price,stock,name,barcode,sku
     FROM products
     WHERE active = 1
       AND (
         brand LIKE ? OR model LIKE ? OR cpu LIKE ?
         OR COALESCE(name,'') LIKE ?
         OR COALESCE(barcode,'') LIKE ?
         OR COALESCE(sku,'') LIKE ?
       )
     ORDER BY created_at DESC`,
    [q, q, q, q, q, q],
  );
};

const mysql_getProductById = async (id: string): Promise<any | null> => {
  return await mysqlQueryOne<any>(`SELECT * FROM products WHERE id = ? LIMIT 1`, [id]);
};

const mysql_getProductByBarcode = async (barcode: string): Promise<any | null> => {
  const b = normalizeBarcode(barcode);
  if (!b) return null;
  return await mysqlQueryOne<any>(
    `SELECT * FROM products
     WHERE active = 1
       AND COALESCE(barcode,'') = ?
       AND (status IS NULL OR status='ACTIVE')
     LIMIT 1`,
    [b],
  );
};

const mysql_isBarcodeTaken = async (barcode: string, excludeId?: string): Promise<boolean> => {
  const b = normalizeBarcode(barcode);
  if (!b) return false;

  const row = await mysqlQueryOne<any>(
    `SELECT id FROM products
     WHERE COALESCE(barcode,'') = ?
       AND active = 1
       AND (? IS NULL OR id <> ?)
     LIMIT 1`,
    [b, excludeId ?? null, excludeId ?? null],
  );

  return !!row;
};

const mysqlNow = (): string => new Date().toISOString().slice(0, 19).replace('T', ' ');

const mysql_upsertProduct = async (payload: any): Promise<string> => {
  const now = mysqlNow(); // ✅ MySQL DATETIME: "YYYY-MM-DD HH:MM:SS"
  const id = payload?.id ?? uuid();

  const p = normalizeProductPayload(payload);

  if (p.barcode && (await mysql_isBarcodeTaken(p.barcode, id))) {
    throw new Error(`Ya existe un producto con ese código de barras: ${p.barcode}`);
  }

  const exists = await mysql_getProductById(id);

  if (exists) {
    const r = await mysqlExec(
      `UPDATE products
       SET brand=?, model=?, cpu=?, ram_gb=?, storage=?, \`condition\`=?, purchase_price=?, sale_price=?, stock=?, notes=?,
           name=?, category=?, sku=?, barcode=?, unit=?, min_stock=?, status=?, location=?,
           updated_at=?
       WHERE id=?`,
      [
        p.brand,
        p.model,
        p.cpu,
        p.ram_gb,
        p.storage,
        p.condition,
        p.purchase_price,
        p.sale_price,
        p.stock,
        p.notes ?? '',
        p.name,
        p.category,
        p.sku,
        p.barcode,
        p.unit,
        p.min_stock,
        p.status,
        p.location,
        now, // ✅
        id,
      ],
    );

    if (!r.affectedRows) throw new Error('Product not updated (MySQL)');
    return id;
  }

  const r = await mysqlExec(
    `INSERT INTO products
      (id,brand,model,cpu,ram_gb,storage,\`condition\`,purchase_price,sale_price,stock,notes,active,
       name,category,sku,barcode,unit,min_stock,status,location,
       created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      p.brand,
      p.model,
      p.cpu,
      p.ram_gb,
      p.storage,
      p.condition,
      p.purchase_price,
      p.sale_price,
      p.stock,
      p.notes ?? '',
      1,
      p.name,
      p.category,
      p.sku,
      p.barcode,
      p.unit,
      p.min_stock,
      p.status,
      p.location,
      now, // ✅
      now, // ✅
    ],
  );

  if (!r.affectedRows) throw new Error('Product not inserted (MySQL)');
  return id;
};

const mysql_archiveProduct = async (id: string): Promise<void> => {
  await mysqlExec(`UPDATE products SET active = 0, updated_at = ? WHERE id = ?`, [nowIso(), id]);
};

// ==================
// PUBLIC (AUTO MODE)
// ==================
export const listProductsRepo = async (search = ''): Promise<any[]> => {
  const mode = await getDbMode();
  return mode === 'mysql' ? await mysql_listProducts(search) : sqlite_listProducts(search);
};

export const listPosProductsRepo = async (search = ''): Promise<any[]> => {
  const mode = await getDbMode();
  return mode === 'mysql' ? await mysql_listPosProducts(search) : sqlite_listPosProducts(search);
};

export const upsertProductRepo = async (payload: ProductPayload): Promise<string> => {
  const mode = await getDbMode();
  return mode === 'mysql' ? await mysql_upsertProduct(payload) : sqlite_upsertProduct(payload);
};

export const updateProductRepo = async (payload: ProductPayload): Promise<any> => {
  const id = String(payload?.id ?? '');
  if (!id) throw new Error('Missing product id');

  const mode = await getDbMode();
  if (mode === 'mysql') {
    await mysql_upsertProduct(payload);
    return await mysql_getProductById(id);
  }

  sqlite_upsertProduct(payload);
  return sqlite_getProductById(id);
};

export const archiveProductRepo = async (id: string): Promise<void> => {
  const mode = await getDbMode();
  if (mode === 'mysql') return await mysql_archiveProduct(id);
  sqlite_archiveProduct(id);
};

// ✅ NUEVO: buscar por código de barras (para pistola)
export const getProductByBarcodeRepo = async (barcode: string): Promise<any | null> => {
  const mode = await getDbMode();
  return mode === 'mysql' ? await mysql_getProductByBarcode(barcode) : sqlite_getProductByBarcode(barcode);
};