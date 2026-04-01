import type { PoolConnection } from 'mysql2/promise';
import { v4 as uuid } from 'uuid';
import { getMySqlPool } from '../mysql';

function pad6(n: number): string {
  return String(n).padStart(6, '0');
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toLocalMySqlDateTime(d = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

async function nextInvoiceNumberMySql(conn: PoolConnection, year: number): Promise<string> {
  await conn.execute(
    `INSERT INTO invoice_counters (\`year\`, last_number, seq)
     VALUES (?, 0, 0)
     ON DUPLICATE KEY UPDATE \`year\` = \`year\``,
    [year],
  );

  await conn.execute(
    `UPDATE invoice_counters
     SET last_number = LAST_INSERT_ID(last_number + 1),
         seq = seq + 1
     WHERE \`year\` = ?`,
    [year],
  );

  const [rows] = await conn.query<any[]>(`SELECT LAST_INSERT_ID() as n`);
  const n = Number(rows?.[0]?.n ?? 0);
  return `ST-${year}-${pad6(n)}`;
}

async function ensureExtraSalesTablesMySql(): Promise<void> {
  const pool = getMySqlPool();

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS suspended_sales (
      id VARCHAR(36) PRIMARY KEY,
      temp_number VARCHAR(60) NOT NULL,
      user_id VARCHAR(36) NULL,
      customer_name VARCHAR(255) NULL,
      customer_id VARCHAR(120) NULL,
      subtotal INT NOT NULL DEFAULT 0,
      discount INT NOT NULL DEFAULT 0,
      total INT NOT NULL DEFAULT 0,
      payment_method VARCHAR(40) NOT NULL DEFAULT 'EFECTIVO',
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      INDEX idx_suspended_sales_created (created_at)
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS suspended_sale_items (
      id VARCHAR(36) PRIMARY KEY,
      suspended_sale_id VARCHAR(36) NOT NULL,
      product_id VARCHAR(36) NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT NULL,
      qty INT NOT NULL DEFAULT 0,
      unit_price INT NOT NULL DEFAULT 0,
      line_total INT NOT NULL DEFAULT 0,
      stock INT NULL,
      unit_cost DOUBLE NOT NULL DEFAULT 0,
      INDEX idx_suspended_sale_items_sale (suspended_sale_id)
    )
  `);
}

async function ensureElectronicInvoiceEventsTableMySql(): Promise<void> {
  const pool = getMySqlPool();

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS electronic_invoice_events (
      id VARCHAR(36) PRIMARY KEY,
      sale_id VARCHAR(36) NOT NULL,
      related_sale_id VARCHAR(36) NULL,
      event_type VARCHAR(20) NOT NULL,
      provider VARCHAR(30) NOT NULL DEFAULT 'factus',
      status VARCHAR(30) NULL,
      provider_document_id BIGINT NULL,
      provider_number VARCHAR(120) NULL,
      provider_public_url TEXT NULL,
      cufe VARCHAR(255) NULL,
      related_provider_document_id BIGINT NULL,
      related_provider_number VARCHAR(120) NULL,
      reason_code VARCHAR(20) NULL,
      reason_text TEXT NULL,
      amount INT NULL,
      payload_json LONGTEXT NULL,
      response_json LONGTEXT NULL,
      error_text TEXT NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      INDEX idx_eie_sale_id (sale_id),
      INDEX idx_eie_related_sale_id (related_sale_id),
      INDEX idx_eie_event_type (event_type),
      INDEX idx_eie_created_at (created_at)
    )
  `);
}

async function ensureSalesFactusColumnsMySql(): Promise<void> {
  const pool = getMySqlPool();

  const addColumnIfMissing = async (columnName: string, definition: string) => {
    const [rows] = await pool.query<any[]>(
      `
      SELECT COUNT(*) AS total
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'sales'
        AND COLUMN_NAME = ?
      `,
      [columnName],
    );

    const exists = Number(rows?.[0]?.total ?? 0) > 0;
    if (exists) return;

    await pool.execute(`ALTER TABLE sales ADD COLUMN ${definition}`);
  };

  await addColumnIfMissing('customer_email', 'customer_email VARCHAR(255) NULL');
  await addColumnIfMissing('customer_phone', 'customer_phone VARCHAR(60) NULL');
  await addColumnIfMissing('customer_address', 'customer_address VARCHAR(255) NULL');
  await addColumnIfMissing('electronic_invoice_requested', 'electronic_invoice_requested TINYINT(1) NOT NULL DEFAULT 0');
  await addColumnIfMissing('factus_status', 'factus_status VARCHAR(30) NULL');
  await addColumnIfMissing('factus_bill_id', 'factus_bill_id BIGINT NULL');
  await addColumnIfMissing('factus_bill_number', 'factus_bill_number VARCHAR(120) NULL');
  await addColumnIfMissing('factus_public_url', 'factus_public_url TEXT NULL');
  await addColumnIfMissing('factus_cufe', 'factus_cufe VARCHAR(255) NULL');
  await addColumnIfMissing('factus_validated_at', 'factus_validated_at VARCHAR(60) NULL');
  await addColumnIfMissing('factus_error', 'factus_error TEXT NULL');
  await addColumnIfMissing('factus_raw_json', 'factus_raw_json LONGTEXT NULL');
}

export async function createSaleMySql(input: any): Promise<{ saleId: string; invoiceNumber: string }> {
  const pool = getMySqlPool();
  const conn = await pool.getConnection();

  try {
    await ensureSalesFactusColumnsMySql();
    await conn.beginTransaction();

    const saleId = uuid();
    const now = toLocalMySqlDateTime(new Date());
    const year = new Date().getFullYear();

    const invoiceNumber = await nextInvoiceNumberMySql(conn, year);

    await conn.execute(
      `INSERT INTO sales
        (
          id,
          invoice_number,
          date,
          user_id,
          payment_method,
          subtotal,
          discount,
          total,
          customer_name,
          customer_id,
          customer_email,
          customer_phone,
          customer_address,
          electronic_invoice_requested,
          factus_status,
          created_at
        )
       VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        saleId,
        invoiceNumber,
        now,
        input.userId,
        String(input.paymentMethod ?? '').trim().toUpperCase(),
        Number(input.subtotal ?? 0),
        Number(input.discount ?? 0),
        Number(input.total ?? 0),
        input.customerName ?? null,
        input.customerId ?? null,
        input.customerEmail ?? null,
        input.customerPhone ?? null,
        input.customerAddress ?? null,
        input.generateElectronicInvoice ? 1 : 0,
        input.generateElectronicInvoice ? 'PENDING' : null,
        now,
      ],
    );

    for (const item of input.items ?? []) {
      const isFreeItem = item.product_id == null;

      if (isFreeItem) {
        const description = String(item.description ?? '').trim();
        if (!description) throw new Error('Descripción requerida para ítem libre.');

        const unitCost = Math.max(0, Number(item.unit_cost ?? 0));
        const qty = Number(item.qty ?? 0);
        const unitPrice = Number(item.unit_price ?? 0);
        const lineTotal = Number(item.line_total ?? unitPrice * qty);

        if (unitPrice < 0 || qty < 1 || unitCost < 0) {
          throw new Error('Valores inválidos para ítem libre.');
        }

        await conn.execute(
          `INSERT INTO sale_items
            (id, sale_id, product_id, qty, unit_price, line_total, description, unit_cost)
           VALUES
            (?, ?, NULL, ?, ?, ?, ?, ?)`,
          [uuid(), saleId, qty, unitPrice, lineTotal, description, unitCost],
        );

        continue;
      }

      const [prows] = await conn.query<any[]>(
        `SELECT stock, purchase_price
         FROM products
         WHERE id = ?
         FOR UPDATE`,
        [item.product_id],
      );

      const product = prows?.[0];
      if (!product) throw new Error('Producto no existe.');

      const stock = Number(product.stock ?? 0);
      const qty = Number(item.qty ?? 0);

      if (qty < 1) throw new Error('Cantidad inválida.');
      if (qty > stock) throw new Error('Stock insuficiente para uno de los productos.');

      const unitPrice = Number(item.unit_price ?? 0);
      const lineTotal = Number(item.line_total ?? unitPrice * qty);
      const unitCost = Number(product.purchase_price ?? 0);

      await conn.execute(
        `INSERT INTO sale_items
          (id, sale_id, product_id, qty, unit_price, line_total, description, unit_cost)
         VALUES
          (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuid(),
          saleId,
          item.product_id,
          qty,
          unitPrice,
          lineTotal,
          String(item.description ?? ''),
          unitCost,
        ],
      );

      await conn.execute(
        `UPDATE products
         SET stock = stock - ?, updated_at = ?
         WHERE id = ?`,
        [qty, now, item.product_id],
      );
    }

    await conn.commit();
    return { saleId, invoiceNumber };
  } catch (e) {
    try {
      await conn.rollback();
    } catch {}
    throw e;
  } finally {
    conn.release();
  }
}

export async function updateSaleElectronicInvoiceMySql(data: {
  saleId: string;
  factusStatus: string | null;
  factusBillId?: number | null;
  factusBillNumber?: string | null;
  factusPublicUrl?: string | null;
  factusCufe?: string | null;
  factusValidatedAt?: string | null;
  factusError?: string | null;
  factusRawJson?: string | null;
}): Promise<void> {
  const pool = getMySqlPool();

  await ensureSalesFactusColumnsMySql();

  await pool.execute(
    `UPDATE sales
     SET
       factus_status = ?,
       factus_bill_id = ?,
       factus_bill_number = ?,
       factus_public_url = ?,
       factus_cufe = ?,
       factus_validated_at = ?,
       factus_error = ?,
       factus_raw_json = ?
     WHERE id = ?`,
    [
      data.factusStatus ?? null,
      data.factusBillId ?? null,
      data.factusBillNumber ?? null,
      data.factusPublicUrl ?? null,
      data.factusCufe ?? null,
      data.factusValidatedAt ?? null,
      data.factusError ?? null,
      data.factusRawJson ?? null,
      data.saleId,
    ],
  );
}

export async function createElectronicInvoiceEventMySql(input: {
  saleId: string;
  relatedSaleId?: string | null;
  eventType: 'CREDIT_NOTE' | 'DEBIT_NOTE';
  provider?: string;
  status?: string | null;
  providerDocumentId?: number | null;
  providerNumber?: string | null;
  providerPublicUrl?: string | null;
  cufe?: string | null;
  relatedProviderDocumentId?: number | null;
  relatedProviderNumber?: string | null;
  reasonCode?: string | null;
  reasonText?: string | null;
  amount?: number | null;
  payloadJson?: string | null;
  responseJson?: string | null;
  errorText?: string | null;
}): Promise<string> {
  await ensureElectronicInvoiceEventsTableMySql();

  const pool = getMySqlPool();
  const id = uuid();
  const now = toLocalMySqlDateTime(new Date());

  await pool.execute(
    `INSERT INTO electronic_invoice_events
      (
        id, sale_id, related_sale_id, event_type, provider, status,
        provider_document_id, provider_number, provider_public_url, cufe,
        related_provider_document_id, related_provider_number,
        reason_code, reason_text, amount, payload_json, response_json,
        error_text, created_at, updated_at
      )
     VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.saleId,
      input.relatedSaleId ?? null,
      input.eventType,
      input.provider ?? 'factus',
      input.status ?? null,
      input.providerDocumentId ?? null,
      input.providerNumber ?? null,
      input.providerPublicUrl ?? null,
      input.cufe ?? null,
      input.relatedProviderDocumentId ?? null,
      input.relatedProviderNumber ?? null,
      input.reasonCode ?? null,
      input.reasonText ?? null,
      input.amount ?? null,
      input.payloadJson ?? null,
      input.responseJson ?? null,
      input.errorText ?? null,
      now,
      now,
    ],
  );

  return id;
}

export async function updateElectronicInvoiceEventMySql(input: {
  id: string;
  status?: string | null;
  providerDocumentId?: number | null;
  providerNumber?: string | null;
  providerPublicUrl?: string | null;
  cufe?: string | null;
  responseJson?: string | null;
  errorText?: string | null;
}): Promise<void> {
  await ensureElectronicInvoiceEventsTableMySql();

  const pool = getMySqlPool();
  const now = toLocalMySqlDateTime(new Date());

  await pool.execute(
    `UPDATE electronic_invoice_events
     SET
       status = ?,
       provider_document_id = ?,
       provider_number = ?,
       provider_public_url = ?,
       cufe = ?,
       response_json = ?,
       error_text = ?,
       updated_at = ?
     WHERE id = ?`,
    [
      input.status ?? null,
      input.providerDocumentId ?? null,
      input.providerNumber ?? null,
      input.providerPublicUrl ?? null,
      input.cufe ?? null,
      input.responseJson ?? null,
      input.errorText ?? null,
      now,
      input.id,
    ],
  );
}

export async function listElectronicInvoiceEventsBySaleMySql(saleId: string): Promise<any[]> {
  await ensureElectronicInvoiceEventsTableMySql();

  const pool = getMySqlPool();
  const [rows] = await pool.query<any[]>(
    `SELECT *
     FROM electronic_invoice_events
     WHERE sale_id = ? OR related_sale_id = ?
     ORDER BY created_at DESC`,
    [saleId, saleId],
  );

  return Array.isArray(rows) ? rows : [];
}

export async function suspendSaleMySql(data: any): Promise<string> {
  await ensureExtraSalesTablesMySql();

  const pool = getMySqlPool();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const id = uuid();
    const tempNumber = `TMP-${Date.now()}`;
    const now = toLocalMySqlDateTime(new Date());

    await conn.execute(
      `INSERT INTO suspended_sales
        (id, temp_number, user_id, customer_name, customer_id, subtotal, discount, total, payment_method, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        tempNumber,
        data.userId ?? null,
        data.customerName ?? null,
        data.customerId ?? null,
        Number(data.subtotal ?? 0),
        Number(data.discount ?? 0),
        Number(data.total ?? 0),
        String(data.paymentMethod ?? 'EFECTIVO').trim().toUpperCase(),
        now,
        now,
      ],
    );

    for (const item of data.items ?? []) {
      await conn.execute(
        `INSERT INTO suspended_sale_items
          (id, suspended_sale_id, product_id, name, description, qty, unit_price, line_total, stock, unit_cost)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuid(),
          id,
          item.product_id ?? null,
          String(item.name ?? 'Producto'),
          String(item.description ?? ''),
          Number(item.qty ?? 0),
          Number(item.unit_price ?? 0),
          Number(item.line_total ?? 0),
          item.stock == null ? null : Number(item.stock),
          Number(item.unit_cost ?? 0),
        ],
      );
    }

    await conn.commit();
    return id;
  } catch (e) {
    try {
      await conn.rollback();
    } catch {}
    throw e;
  } finally {
    conn.release();
  }
}

export async function listSuspendedSalesMySql(): Promise<any[]> {
  await ensureExtraSalesTablesMySql();

  const pool = getMySqlPool();
  const [rows] = await pool.query<any[]>(
    `SELECT id, temp_number, customer_name, customer_id, subtotal, discount, total, payment_method, created_at
     FROM suspended_sales
     ORDER BY created_at DESC`,
  );

  return Array.isArray(rows) ? rows : [];
}

export async function getSuspendedSaleMySql(id: string): Promise<any | null> {
  await ensureExtraSalesTablesMySql();

  const pool = getMySqlPool();

  const [salesRows] = await pool.query<any[]>(
    `SELECT *
     FROM suspended_sales
     WHERE id = ?
     LIMIT 1`,
    [id],
  );

  const sale = salesRows?.[0];
  if (!sale) return null;

  const [itemsRows] = await pool.query<any[]>(
    `SELECT *
     FROM suspended_sale_items
     WHERE suspended_sale_id = ?
     ORDER BY id ASC`,
    [id],
  );

  return {
    ...sale,
    items: Array.isArray(itemsRows) ? itemsRows : [],
  };
}

export async function deleteSuspendedSaleMySql(id: string): Promise<void> {
  await ensureExtraSalesTablesMySql();

  const pool = getMySqlPool();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    await conn.execute(
      `DELETE FROM suspended_sale_items WHERE suspended_sale_id = ?`,
      [id],
    );

    await conn.execute(
      `DELETE FROM suspended_sales WHERE id = ?`,
      [id],
    );

    await conn.commit();
  } catch (e) {
    try {
      await conn.rollback();
    } catch {}
    throw e;
  } finally {
    conn.release();
  }
}

export async function listRecentSalesMySql(limit = 30): Promise<any[]> {
  const pool = getMySqlPool();
  const safeLimit = Math.max(1, Math.min(Number(limit) || 30, 500));

  const [rows] = await pool.execute<any[]>(
    `SELECT
        id,
        invoice_number,
        date,
        total,
        payment_method,
        customer_name,
        customer_id,
        factus_status,
        factus_bill_number,
        factus_public_url
     FROM sales
     ORDER BY created_at DESC
     LIMIT ${safeLimit}`,
  );

  return Array.isArray(rows) ? rows : [];
}

export async function getSaleDetailMySql(saleId: string): Promise<any | null> {
  const pool = getMySqlPool();

  const [salesRows] = await pool.query<any[]>(
    `SELECT *
     FROM sales
     WHERE id = ?
     LIMIT 1`,
    [saleId],
  );

  const sale = salesRows?.[0];
  if (!sale) return null;

  const [itemsRows] = await pool.query<any[]>(
    `SELECT *
     FROM sale_items
     WHERE sale_id = ?
     ORDER BY id ASC`,
    [saleId],
  );

  const [eventsRows] = await pool.query<any[]>(
    `SELECT *
     FROM electronic_invoice_events
     WHERE sale_id = ? OR related_sale_id = ?
     ORDER BY created_at DESC`,
    [saleId, saleId],
  ).catch(() => [[] as any[]]);

  return {
    ...sale,
    items: Array.isArray(itemsRows) ? itemsRows : [],
    electronic_events: Array.isArray(eventsRows) ? eventsRows : [],
  };
}

export async function returnSaleMySql(data: any): Promise<{ totalReturned: number }> {
  const pool = getMySqlPool();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const returnId = uuid();
    const now = toLocalMySqlDateTime(new Date());

    let totalReturned = 0;

    for (const item of data.items ?? []) {
      const [rows] = await conn.query<any[]>(
        `SELECT product_id, qty, unit_price
         FROM sale_items
         WHERE id = ?`,
        [item.sale_item_id],
      );

      const saleItem = rows?.[0];
      if (!saleItem) continue;

      const qty = Number(item.qty ?? 0);
      const unitPrice = Number(saleItem.unit_price ?? 0);
      const lineTotal = qty * unitPrice;

      totalReturned += lineTotal;

      await conn.execute(
        `INSERT INTO sale_return_items
         (id, return_id, sale_item_id, product_id, qty, unit_price, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          uuid(),
          returnId,
          item.sale_item_id,
          saleItem.product_id ?? null,
          qty,
          unitPrice,
          lineTotal,
        ],
      );

      if (saleItem.product_id) {
        await conn.execute(
          `UPDATE products
           SET stock = stock + ?
           WHERE id = ?`,
          [qty, saleItem.product_id],
        );
      }
    }

    await conn.execute(
      `INSERT INTO sale_returns
       (id, sale_id, user_id, reason, total_returned, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        returnId,
        data.saleId,
        data.userId,
        data.reason ?? '',
        totalReturned,
        now,
      ],
    );

    await conn.commit();

    return { totalReturned };
  } catch (e) {
    try { await conn.rollback(); } catch {}
    throw e;
  } finally {
    conn.release();
  }
}