// app/electron/db/mysql/reports.mysql.ts
import { mysqlQueryAll } from '../mysql';

// -------------------- Helpers --------------------

// Toma "YYYY-MM-DD" de cualquier string (ISO, datetime, etc.)
const ymd = (s: string) => String(s ?? '').trim().slice(0, 10);

// Fecha local "YYYY-MM-DD" (evita líos de UTC)
const localYmd = (d = new Date()): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// Normaliza números que vienen como string/decimal/etc.
const num = (v: any): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// -------------------- REPORTES --------------------

export const reportSalesByDayMySql = async (from: string, to: string): Promise<any[]> => {
  const f = ymd(from);
  const t = ymd(to);

  return await mysqlQueryAll<any>(
    `SELECT LEFT(date,10) as day, COALESCE(SUM(total),0) as total
     FROM sales
     WHERE LEFT(date,10) BETWEEN ? AND ?
     GROUP BY LEFT(date,10)
     ORDER BY day`,
    [f, t],
  );
};

export const reportTopProductsMySql = async (from: string, to: string): Promise<any[]> => {
  const f = ymd(from);
  const t = ymd(to);

  return await mysqlQueryAll<any>(
    `SELECT
       COALESCE(
         NULLIF(TRIM(IFNULL(p.name,'')), ''),
         NULLIF(TRIM(CONCAT(IFNULL(p.brand,''),' ',IFNULL(p.model,''))), ''),
         'Producto'
       ) AS name,
       COALESCE(SUM(si.qty),0) AS qty
     FROM sale_items si
     JOIN sales s ON s.id = si.sale_id
     LEFT JOIN products p ON p.id = si.product_id
     WHERE LEFT(s.date,10) BETWEEN ? AND ?
       AND si.product_id IS NOT NULL
     GROUP BY si.product_id, name
     ORDER BY qty DESC
     LIMIT 10`,
    [f, t],
  );
};

export const reportSummaryMySql = async (from: string, to: string): Promise<any> => {
  const f = ymd(from);
  const t = ymd(to);

  const rows = await mysqlQueryAll<any>(
    `SELECT
       (SELECT COALESCE(SUM(total),0)
          FROM sales
         WHERE LEFT(date,10) BETWEEN ? AND ?
       ) as total_sales,

       (SELECT COALESCE(SUM(amount),0)
          FROM expenses
         WHERE LEFT(date,10) BETWEEN ? AND ?
       ) as total_expenses,

       (SELECT COALESCE(SUM(si.qty * COALESCE(si.unit_cost, p.purchase_price, 0)),0)
          FROM sale_items si
          JOIN sales s ON s.id = si.sale_id
          LEFT JOIN products p ON p.id = si.product_id
         WHERE LEFT(s.date,10) BETWEEN ? AND ?
       ) as total_costs`,
    [f, t, f, t, f, t],
  );

  const r = rows?.[0] ?? { total_sales: 0, total_expenses: 0, total_costs: 0 };

  return {
    total_sales: num(r.total_sales),
    total_expenses: num(r.total_expenses),
    total_costs: num(r.total_costs),
  };
};

export const getTodaySummaryMySql = async (): Promise<any> => {
  // ✅ Local (no UTC)
  const today = localYmd(new Date());

  const rows = await mysqlQueryAll<any>(
    `SELECT
       (SELECT COALESCE(SUM(total),0)
          FROM sales
         WHERE LEFT(date,10) = ?
       ) as total_sales,

       (SELECT COALESCE(SUM(total),0)
          FROM sales
         WHERE LEFT(date,10) = ?
           AND payment_method = 'EFECTIVO'
       ) as cash_sales,

       (SELECT COALESCE(SUM(amount),0)
          FROM expenses
         WHERE LEFT(date,10) = ?
       ) as total_expenses,

       (SELECT COALESCE(SUM(si.qty * COALESCE(si.unit_cost, p.purchase_price, 0)),0)
          FROM sale_items si
          JOIN sales s ON s.id = si.sale_id
          LEFT JOIN products p ON p.id = si.product_id
         WHERE LEFT(s.date,10) = ?
       ) as total_costs`,
    [today, today, today, today],
  );

  const r =
    rows?.[0] ?? { total_sales: 0, cash_sales: 0, total_expenses: 0, total_costs: 0 };

  return {
    day: today,
    total_sales: num(r.total_sales),
    cash_sales: num(r.cash_sales),
    total_expenses: num(r.total_expenses),
    total_costs: num(r.total_costs),
  };
};

export const getLast7DaysSalesMySql = async (): Promise<any[]> => {
  // ✅ Local (no UTC)
  const now = new Date();
  const to = localYmd(now);

  const fromD = new Date(now);
  fromD.setDate(now.getDate() - 6);
  const from = localYmd(fromD);

  return await mysqlQueryAll<any>(
    `SELECT LEFT(date,10) as day, COALESCE(SUM(total),0) as total
     FROM sales
     WHERE LEFT(date,10) BETWEEN ? AND ?
     GROUP BY LEFT(date,10)
     ORDER BY day`,
    [from, to],
  );
};

// ✅ Cierre diario con gastos + neto (y fecha en formato tuyo)
export const reportDailyCloseMySql = async (from: string, to: string) => {
  const f = ymd(from);
  const t = ymd(to);

  // 1) Ventas por método
  const rows = await mysqlQueryAll<{ payment_method: string; total: any }>(
    `SELECT payment_method, COALESCE(SUM(total),0) as total
     FROM sales
     WHERE LEFT(date,10) BETWEEN ? AND ?
     GROUP BY payment_method`,
    [f, t],
  );

  const totalsByMethod: Record<string, number> = {};
  let totalSales = 0;

  for (const r of rows ?? []) {
    const pm = String((r as any)?.payment_method ?? 'OTRO').trim() || 'OTRO';
    const v = num((r as any)?.total);
    totalsByMethod[pm] = num(totalsByMethod[pm]) + v;
    totalSales += v;
  }

  // 2) Utilidad (solo items con product_id)
  const profitRows = await mysqlQueryAll<{ profit: any }>(
    `SELECT COALESCE(SUM(si.line_total - (COALESCE(si.unit_cost,0) * si.qty)),0) as profit
     FROM sale_items si
     JOIN sales s ON s.id = si.sale_id
     WHERE LEFT(s.date,10) BETWEEN ? AND ?
       AND si.product_id IS NOT NULL`,
    [f, t],
  );
  const profit = num((profitRows?.[0] as any)?.profit);

  // 3) Gastos
  const expRows = await mysqlQueryAll<{ total_expenses: any }>(
    `SELECT COALESCE(SUM(amount),0) as total_expenses
     FROM expenses
     WHERE LEFT(date,10) BETWEEN ? AND ?`,
    [f, t],
  );
  const totalExpenses = num((expRows?.[0] as any)?.total_expenses);

  // 4) Neto
  const net = profit - totalExpenses;

  // 5) Extra útil: ventas en efectivo (para “dinero esperado”)
  const cashSales = num(totalsByMethod['EFECTIVO'] ?? 0);

  return {
    from: f,
    to: t,

    // ventas
    totalSales,
    cashSales,
    totalsByMethod,

    // resultados
    profit,
    totalExpenses,
    net,
  };
};