import { closeCash, createSale, getCashStatus, getOpenCash, openCash } from '../app/electron/db/queries';
import { insertUser, setupTestDb, teardownTestDb } from './helpers/testDb';

describe('cash queries', () => {
  let db: ReturnType<typeof setupTestDb>;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2025-01-10T12:00:00.000Z'));
    db = setupTestDb();
    insertUser(db, 'user-1');
  });

  afterEach(() => {
    teardownTestDb(db);
    jest.useRealTimers();
  });

  test('openCash creates open cash row and getOpenCash returns it', () => {
    const id = openCash({ userId: 'user-1', openingCash: 100000 }) as string;
    const row = getOpenCash() as any;
    expect(row.id).toBe(id);
    expect(row.opening_cash).toBe(100000);
    expect(row.closed_at).toBeNull();
  });

  test('getCashStatus computes expectedCash with cash sales and expenses', () => {
    const cashId = openCash({ userId: 'user-1', openingCash: 100000 }) as string;
    const opened = db.prepare('SELECT opened_at FROM cash_closures WHERE id = ?').get(cashId) as { opened_at: string };
    const inRangeDate = opened.opened_at;

    db.prepare('INSERT INTO sales (id,invoice_number,date,user_id,payment_method,subtotal,discount,total,customer_name,customer_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(
      'sale-1',
      'ST-2025-000001',
      inRangeDate,
      'user-1',
      'EFECTIVO',
      50000,
      0,
      50000,
      '',
      '',
      inRangeDate,
    );

    db.prepare('INSERT INTO expenses (id,date,concept,amount,notes,created_at) VALUES (?,?,?,?,?,?)').run(
      'exp-1',
      inRangeDate,
      'Taxi',
      10000,
      '',
      inRangeDate,
    );

    const status = getCashStatus() as any;
    expect(status.openingCash).toBe(100000);
    expect(status.cashSales).toBe(50000);
    expect(status.expenses).toBe(10000);
    expect(status.expectedCash).toBe(140000);

    expect(cashId).toBeTruthy();
  });

  test('closeCash saves expected_cash and diff', () => {
    const productId = 'p-1';
    db.prepare('INSERT INTO products (id,brand,model,cpu,ram_gb,storage,condition,purchase_price,sale_price,stock,notes,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(
      productId,
      'Lenovo',
      'T14',
      'i5',
      16,
      '512GB',
      'Usado',
      1000,
      2000,
      10,
      '',
      1,
      '2025-01-10T11:00:00.000Z',
      '2025-01-10T11:00:00.000Z',
    );

    const cashId = openCash({ userId: 'user-1', openingCash: 100000 }) as string;

    createSale({
      userId: 'user-1',
      paymentMethod: 'EFECTIVO',
      subtotal: 2000,
      discount: 0,
      total: 2000,
      items: [{ product_id: productId, qty: 1, unit_price: 2000, line_total: 2000 }],
    });

    const result = closeCash({ id: cashId, countedCash: 101500, userId: 'user-1', notes: '' }) as any;
    expect(result.expectedCash).toBe(102000);
    expect(result.diff).toBe(-500);

    const row = db.prepare('SELECT expected_cash, difference FROM cash_closures WHERE id = ?').get(cashId) as any;
    expect(row.expected_cash).toBe(102000);
    expect(row.difference).toBe(-500);
  });
});
