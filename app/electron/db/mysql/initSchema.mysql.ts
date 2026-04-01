import { readMySqlConfig } from '../mysqlConfig';
import { mysqlExec, mysqlQueryOne } from '../mysql';

import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';

async function getColumnInfo(table: string, column: string): Promise<{ dataType?: string; columnType?: string } | null> {
  const cfg = readMySqlConfig();
  if (!cfg?.database) throw new Error('MySQL config no encontrada');

  const row = await mysqlQueryOne<{ DATA_TYPE: string; COLUMN_TYPE: string }>(
    `
    SELECT DATA_TYPE, COLUMN_TYPE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = ?
      AND TABLE_NAME = ?
      AND COLUMN_NAME = ?
    LIMIT 1
    `,
    [cfg.database, table, column],
  );

  if (!row) return null;
  return {
    dataType: String((row as any).DATA_TYPE ?? ''),
    columnType: String((row as any).COLUMN_TYPE ?? ''),
  };
}

async function columnExists(table: string, column: string): Promise<boolean> {
  const cfg = readMySqlConfig();
  if (!cfg?.database) throw new Error('MySQL config no encontrada');

  const row = await mysqlQueryOne<{ c: number }>(
    `
    SELECT COUNT(*) as c
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = ?
      AND TABLE_NAME = ?
      AND COLUMN_NAME = ?
    `,
    [cfg.database, table, column],
  );

  return Number((row as any)?.c ?? 0) > 0;
}

async function addColumnIfMissing(table: string, column: string, ddl: string): Promise<void> {
  const exists = await columnExists(table, column);
  if (exists) return;
  await mysqlExec(`ALTER TABLE \`${table}\` ADD COLUMN ${ddl}`);
}

async function indexExists(table: string, indexName: string): Promise<boolean> {
  const cfg = readMySqlConfig();
  if (!cfg?.database) throw new Error('MySQL config no encontrada');

  const row = await mysqlQueryOne<{ c: number }>(
    `
    SELECT COUNT(*) as c
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = ?
      AND TABLE_NAME = ?
      AND INDEX_NAME = ?
    `,
    [cfg.database, table, indexName],
  );

  return Number((row as any)?.c ?? 0) > 0;
}

async function addIndexIfMissing(table: string, indexName: string, ddl: string): Promise<void> {
  const exists = await indexExists(table, indexName);
  if (exists) return;
  await mysqlExec(`ALTER TABLE \`${table}\` ADD ${ddl}`);
}

async function ensureDateTimeColumn(table: string, column: string): Promise<void> {
  const info = await getColumnInfo(table, column);
  if (!info) return;

  const dt = (info.dataType ?? '').toLowerCase();
  if (dt === 'datetime' || dt === 'timestamp' || dt === 'date') return;

  const tmp = `${column}__dt`;
  const tmpExists = await columnExists(table, tmp);
  if (!tmpExists) {
    await mysqlExec(`ALTER TABLE \`${table}\` ADD COLUMN \`${tmp}\` DATETIME NULL AFTER \`${column}\``);
  }

  await mysqlExec(`
    UPDATE \`${table}\`
    SET \`${tmp}\` =
      CASE
        WHEN \`${column}\` IS NULL OR TRIM(\`${column}\`) = '' THEN NULL
        WHEN \`${column}\` REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
          THEN STR_TO_DATE(CONCAT(\`${column}\`, ' 00:00:00'), '%Y-%m-%d %H:%i:%s')
        WHEN \`${column}\` LIKE '%T%'
          THEN STR_TO_DATE(
            REPLACE(
              SUBSTRING_INDEX(REPLACE(REPLACE(\`${column}\`, 'Z',''), 'T',' '), '.', 1),
              'T',' '
            ),
            '%Y-%m-%d %H:%i:%s'
          )
        ELSE
          STR_TO_DATE(SUBSTRING_INDEX(\`${column}\`, '.', 1), '%Y-%m-%d %H:%i:%s')
      END
  `);

  await mysqlExec(`ALTER TABLE \`${table}\` DROP COLUMN \`${column}\``);
  await mysqlExec(`ALTER TABLE \`${table}\` CHANGE COLUMN \`${tmp}\` \`${column}\` DATETIME NULL`);

  if (['sales', 'expenses', 'purchases'].includes(table) && column === 'date') {
    await mysqlExec(`UPDATE \`${table}\` SET \`${column}\` = NOW() WHERE \`${column}\` IS NULL`);
    await mysqlExec(`ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` DATETIME NOT NULL`);
  }
  if (
    ['sales', 'expenses', 'products', 'users', 'audit_logs', 'suppliers', 'purchases', 'sale_returns', 'suspended_sales', 'electronic_billing_settings', 'electronic_invoice_events'].includes(table) &&
    column === 'created_at'
  ) {
    await mysqlExec(`UPDATE \`${table}\` SET \`${column}\` = NOW() WHERE \`${column}\` IS NULL`);
    await mysqlExec(`ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` DATETIME NOT NULL`);
  }
  if (['products', 'suppliers', 'suspended_sales', 'electronic_billing_settings', 'electronic_invoice_events'].includes(table) && column === 'updated_at') {
    await mysqlExec(`UPDATE \`${table}\` SET \`${column}\` = NOW() WHERE \`${column}\` IS NULL`);
    await mysqlExec(`ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` DATETIME NOT NULL`);
  }
}

async function seedAdminIfMissing(): Promise<void> {
  const adminEmail = 'admin@sistetecni.com';
  const exists = await mysqlQueryOne<{ id: string }>(
    `SELECT id FROM users WHERE email = ? LIMIT 1`,
    [adminEmail],
  );
  if ((exists as any)?.id) return;

  const id = uuid();
  const hash = bcrypt.hashSync('Admin123*', 10);

  await mysqlExec(
    `INSERT INTO users (id, name, email, password_hash, role, created_at)
     VALUES (?,?,?,?,?,?)`,
    [id, 'Administrador', adminEmail, hash, 'ADMIN', new Date()],
  );
}

export async function initMySqlSchema(): Promise<{ ok: true }> {
  await mysqlExec(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL,
      created_at DATETIME NOT NULL
    );
  `);

  await mysqlExec(`
    CREATE TABLE IF NOT EXISTS products (
      id VARCHAR(36) PRIMARY KEY,
      brand VARCHAR(120) NOT NULL,
      model VARCHAR(120) NOT NULL,
      cpu VARCHAR(120) NOT NULL,
      ram_gb INT NOT NULL,
      storage VARCHAR(120) NOT NULL,
      \`condition\` VARCHAR(40) NOT NULL,
      purchase_price INT NOT NULL,
      sale_price INT NOT NULL,
      stock INT NOT NULL,
      notes TEXT NULL,
      active TINYINT NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL
    );
  `);

  await mysqlExec(`
    CREATE TABLE IF NOT EXISTS sales (
      id VARCHAR(36) PRIMARY KEY,
      invoice_number VARCHAR(60) NOT NULL UNIQUE,
      date DATETIME NOT NULL,
      user_id VARCHAR(36) NOT NULL,
      payment_method VARCHAR(40) NOT NULL,
      subtotal INT NOT NULL,
      discount INT NOT NULL,
      total INT NOT NULL,
      customer_name VARCHAR(255) NULL,
      customer_id VARCHAR(120) NULL,
      created_at DATETIME NOT NULL,
      INDEX idx_sales_date (date),
      INDEX idx_sales_payment (payment_method)
    );
  `);

  await mysqlExec(`
    CREATE TABLE IF NOT EXISTS sale_items (
      id VARCHAR(36) PRIMARY KEY,
      sale_id VARCHAR(36) NOT NULL,
      product_id VARCHAR(36) NULL,
      qty INT NOT NULL,
      unit_price INT NOT NULL,
      line_total INT NOT NULL,
      description TEXT NULL,
      unit_cost DOUBLE NOT NULL DEFAULT 0,
      INDEX idx_sale_items_sale (sale_id),
      INDEX idx_sale_items_product (product_id)
    );
  `);

  await mysqlExec(`
    CREATE TABLE IF NOT EXISTS expenses (
      id VARCHAR(36) PRIMARY KEY,
      date DATETIME NOT NULL,
      concept VARCHAR(255) NOT NULL,
      amount INT NOT NULL,
      notes TEXT NULL,
      created_at DATETIME NOT NULL,
      INDEX idx_expenses_date (date)
    );
  `);

  await mysqlExec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id VARCHAR(36) PRIMARY KEY,
      actor_user_id VARCHAR(36) NOT NULL,
      action VARCHAR(80) NOT NULL,
      entity_type VARCHAR(80) NOT NULL,
      entity_id VARCHAR(120) NULL,
      metadata JSON NULL,
      created_at DATETIME NOT NULL,
      INDEX idx_audit_created (created_at),
      INDEX idx_audit_action (action)
    );
  `);

  await mysqlExec(`
    CREATE TABLE IF NOT EXISTS cash_closures (
      id VARCHAR(36) PRIMARY KEY,
      opened_at DATETIME NOT NULL,
      closed_at DATETIME NULL,
      opened_by VARCHAR(36) NOT NULL,
      opening_notes TEXT NULL,
      closed_by VARCHAR(36) NULL,
      opening_cash INT NOT NULL,
      expected_cash INT NULL,
      counted_cash INT NULL,
      total_sales INT NULL,
      total_expenses INT NULL,
      difference INT NULL,
      notes TEXT NULL,
      INDEX idx_cash_opened (opened_at)
    );
  `);

  await mysqlExec(`
    CREATE TABLE IF NOT EXISTS cash_sessions (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      opened_at DATETIME NOT NULL,
      closed_at DATETIME NULL,
      opening_cash INT NOT NULL DEFAULT 0,
      expected_cash INT NOT NULL DEFAULT 0,
      counted_cash INT NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NULL,
      INDEX idx_cash_sessions_opened (opened_at),
      INDEX idx_cash_sessions_user (user_id)
    );
  `);

  await mysqlExec(`
    CREATE TABLE IF NOT EXISTS cash_movements (
      id VARCHAR(36) PRIMARY KEY,
      session_id VARCHAR(36) NOT NULL,
      type VARCHAR(32) NOT NULL,
      amount INT NOT NULL DEFAULT 0,
      note VARCHAR(255) NULL,
      created_at DATETIME NOT NULL,
      INDEX idx_cash_movements_session (session_id),
      INDEX idx_cash_movements_created (created_at)
    );
  `);

  await mysqlExec(`
    CREATE TABLE IF NOT EXISTS suspended_sales (
      id VARCHAR(36) PRIMARY KEY,
      temp_number VARCHAR(60) NOT NULL UNIQUE,
      user_id VARCHAR(36) NOT NULL,
      customer_name VARCHAR(255) NULL,
      customer_id VARCHAR(120) NULL,
      subtotal INT NOT NULL DEFAULT 0,
      discount INT NOT NULL DEFAULT 0,
      total INT NOT NULL DEFAULT 0,
      payment_method VARCHAR(40) NOT NULL DEFAULT 'EFECTIVO',
      notes TEXT NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      INDEX idx_suspended_sales_created_at (created_at),
      INDEX idx_suspended_sales_user_id (user_id)
    );
  `);

  await mysqlExec(`
    CREATE TABLE IF NOT EXISTS suspended_sale_items (
      id VARCHAR(36) PRIMARY KEY,
      suspended_sale_id VARCHAR(36) NOT NULL,
      product_id VARCHAR(36) NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT NULL,
      qty INT NOT NULL,
      unit_price INT NOT NULL,
      line_total INT NOT NULL,
      stock INT NULL,
      unit_cost DOUBLE NOT NULL DEFAULT 0,
      INDEX idx_suspended_sale_items_sale (suspended_sale_id),
      INDEX idx_suspended_sale_items_product (product_id)
    );
  `);

  await mysqlExec(`
    CREATE TABLE IF NOT EXISTS sale_returns (
      id VARCHAR(36) PRIMARY KEY,
      sale_id VARCHAR(36) NOT NULL,
      user_id VARCHAR(36) NOT NULL,
      reason TEXT NULL,
      total_returned INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL,
      INDEX idx_sale_returns_sale_id (sale_id),
      INDEX idx_sale_returns_created_at (created_at)
    );
  `);

  await mysqlExec(`
    CREATE TABLE IF NOT EXISTS sale_return_items (
      id VARCHAR(36) PRIMARY KEY,
      return_id VARCHAR(36) NOT NULL,
      sale_item_id VARCHAR(36) NOT NULL,
      product_id VARCHAR(36) NULL,
      qty INT NOT NULL,
      unit_price INT NOT NULL,
      line_total INT NOT NULL,
      description TEXT NULL,
      INDEX idx_sale_return_items_return_id (return_id),
      INDEX idx_sale_return_items_sale_item_id (sale_item_id)
    );
  `);

  await mysqlExec(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      contact_name VARCHAR(255) NULL,
      phone VARCHAR(80) NULL,
      email VARCHAR(255) NULL,
      address TEXT NULL,
      notes TEXT NULL,
      active TINYINT NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      INDEX idx_suppliers_name (name)
    );
  `);

  await mysqlExec(`
    CREATE TABLE IF NOT EXISTS purchases (
      id VARCHAR(36) PRIMARY KEY,
      supplier_id VARCHAR(36) NULL,
      user_id VARCHAR(36) NOT NULL,
      invoice_ref VARCHAR(120) NULL,
      date DATETIME NOT NULL,
      subtotal INT NOT NULL DEFAULT 0,
      total INT NOT NULL DEFAULT 0,
      notes TEXT NULL,
      created_at DATETIME NOT NULL,
      INDEX idx_purchases_date (date),
      INDEX idx_purchases_supplier_id (supplier_id)
    );
  `);

  await mysqlExec(`
    CREATE TABLE IF NOT EXISTS purchase_items (
      id VARCHAR(36) PRIMARY KEY,
      purchase_id VARCHAR(36) NOT NULL,
      product_id VARCHAR(36) NOT NULL,
      qty INT NOT NULL,
      unit_cost INT NOT NULL,
      line_total INT NOT NULL,
      INDEX idx_purchase_items_purchase_id (purchase_id),
      INDEX idx_purchase_items_product_id (product_id)
    );
  `);

  await mysqlExec(`
    CREATE TABLE IF NOT EXISTS invoice_counters (
      \`year\` INT NOT NULL PRIMARY KEY,
      last_number INT NOT NULL DEFAULT 0,
      seq BIGINT NOT NULL DEFAULT 0
    );
  `);

  await mysqlExec(`
    CREATE TABLE IF NOT EXISTS electronic_billing_settings (
      id VARCHAR(36) PRIMARY KEY,
      enabled TINYINT(1) NOT NULL DEFAULT 0,
      provider VARCHAR(30) NOT NULL DEFAULT 'factus',
      environment VARCHAR(20) NOT NULL DEFAULT 'sandbox',
      base_url VARCHAR(255) NOT NULL,
      username VARCHAR(255) NULL,
      password VARCHAR(255) NULL,
      client_id VARCHAR(255) NULL,
      client_secret VARCHAR(255) NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL
    );
  `);

  await mysqlExec(`
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
    );
  `);

  await addColumnIfMissing('products', 'name', '`name` VARCHAR(255) NULL AFTER `id`');
  await addColumnIfMissing('products', 'category', '`category` VARCHAR(120) NULL AFTER `name`');
  await addColumnIfMissing('products', 'sku', '`sku` VARCHAR(64) NULL AFTER `category`');
  await addColumnIfMissing('products', 'barcode', '`barcode` VARCHAR(64) NULL AFTER `sku`');
  await addColumnIfMissing('products', 'unit', "`unit` VARCHAR(20) NOT NULL DEFAULT 'UND' AFTER `barcode`");
  await addColumnIfMissing('products', 'min_stock', '`min_stock` INT NOT NULL DEFAULT 0 AFTER `stock`');
  await addColumnIfMissing('products', 'status', "`status` VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' AFTER `active`");
  await addColumnIfMissing('products', 'location', '`location` VARCHAR(120) NULL AFTER `notes`');

  await addColumnIfMissing('sales', 'customer_email', '`customer_email` VARCHAR(255) NULL AFTER `customer_id`');
  await addColumnIfMissing('sales', 'customer_phone', '`customer_phone` VARCHAR(60) NULL AFTER `customer_email`');
  await addColumnIfMissing('sales', 'customer_address', '`customer_address` VARCHAR(255) NULL AFTER `customer_phone`');
  await addColumnIfMissing('sales', 'electronic_invoice_requested', '`electronic_invoice_requested` TINYINT(1) NOT NULL DEFAULT 0 AFTER `customer_address`');
  await addColumnIfMissing('sales', 'factus_status', '`factus_status` VARCHAR(30) NULL AFTER `electronic_invoice_requested`');
  await addColumnIfMissing('sales', 'factus_bill_id', '`factus_bill_id` BIGINT NULL AFTER `factus_status`');
  await addColumnIfMissing('sales', 'factus_bill_number', '`factus_bill_number` VARCHAR(120) NULL AFTER `factus_bill_id`');
  await addColumnIfMissing('sales', 'factus_public_url', '`factus_public_url` TEXT NULL AFTER `factus_bill_number`');
  await addColumnIfMissing('sales', 'factus_cufe', '`factus_cufe` VARCHAR(255) NULL AFTER `factus_public_url`');
  await addColumnIfMissing('sales', 'factus_validated_at', '`factus_validated_at` VARCHAR(60) NULL AFTER `factus_cufe`');
  await addColumnIfMissing('sales', 'factus_error', '`factus_error` TEXT NULL AFTER `factus_validated_at`');
  await addColumnIfMissing('sales', 'factus_raw_json', '`factus_raw_json` LONGTEXT NULL AFTER `factus_error`');

  await addIndexIfMissing('products', 'idx_products_barcode', 'INDEX idx_products_barcode (`barcode`)');
  await addIndexIfMissing('products', 'idx_products_sku', 'INDEX idx_products_sku (`sku`)');

  await ensureDateTimeColumn('users', 'created_at');
  await ensureDateTimeColumn('products', 'created_at');
  await ensureDateTimeColumn('products', 'updated_at');
  await ensureDateTimeColumn('sales', 'date');
  await ensureDateTimeColumn('sales', 'created_at');
  await ensureDateTimeColumn('expenses', 'date');
  await ensureDateTimeColumn('expenses', 'created_at');
  await ensureDateTimeColumn('audit_logs', 'created_at');
  await ensureDateTimeColumn('cash_closures', 'opened_at');
  await ensureDateTimeColumn('cash_closures', 'closed_at');
  await ensureDateTimeColumn('cash_sessions', 'opened_at');
  await ensureDateTimeColumn('cash_sessions', 'closed_at');
  await ensureDateTimeColumn('cash_sessions', 'created_at');
  await ensureDateTimeColumn('suppliers', 'created_at');
  await ensureDateTimeColumn('suppliers', 'updated_at');
  await ensureDateTimeColumn('purchases', 'date');
  await ensureDateTimeColumn('purchases', 'created_at');
  await ensureDateTimeColumn('sale_returns', 'created_at');
  await ensureDateTimeColumn('suspended_sales', 'created_at');
  await ensureDateTimeColumn('suspended_sales', 'updated_at');
  await ensureDateTimeColumn('electronic_billing_settings', 'created_at');
  await ensureDateTimeColumn('electronic_billing_settings', 'updated_at');
  await ensureDateTimeColumn('electronic_invoice_events', 'created_at');
  await ensureDateTimeColumn('electronic_invoice_events', 'updated_at');

  await seedAdminIfMissing();

  return { ok: true };
}