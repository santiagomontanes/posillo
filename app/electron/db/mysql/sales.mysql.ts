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

export async function createSaleMySql(input: any): Promise<{ saleId: string; invoiceNumber: string }> {
  const pool = getMySqlPool();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const saleId = uuid();

    // ✅ FECHA LOCAL MYSQL, no UTC
    const now = toLocalMySqlDateTime(new Date());
    const year = new Date().getFullYear();

    const invoiceNumber = await nextInvoiceNumberMySql(conn, year);

    console.log('[SALE MYSQL]', {
      now,
      paymentMethod: String(input.paymentMethod ?? '').trim().toUpperCase(),
      total: Number(input.total ?? 0),
    });

    await conn.execute(
      `INSERT INTO sales
        (id, invoice_number, date, user_id, payment_method, subtotal, discount, total, customer_name, customer_id, created_at)
       VALUES
        (?,  ?,            ?,    ?,       ?,              ?,        ?,        ?,     ?,            ?,           ?)`,
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
            (?,  ?,       NULL,      ?,   ?,          ?,          ?,          ?)`,
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
          (?,  ?,       ?,          ?,   ?,          ?,          ?,           ?)`,
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