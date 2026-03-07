import { createSale, reportSummary, reportTopProducts, upsertProduct } from '../app/electron/db/queries';
import { insertUser, setupTestDb, teardownTestDb } from './helpers/testDb';
import { setDbForTests } from '../app/electron/db/db';

describe('reports queries', () => {
  let db: ReturnType<typeof setupTestDb>;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2025-01-10T12:00:00.000Z'));
    db = setupTestDb();

    // ✅ Asegura que getDb() use SIEMPRE esta DB en memoria en este test
    setDbForTests(db);

    insertUser(db, 'seller-1');
  });

  afterEach(() => {
    teardownTestDb(db);
    jest.useRealTimers();
  });

  test('reportSummary returns totals including free-item unit_cost', () => {
    const productId = upsertProduct({
      brand: 'HP',
      model: '14',
      cpu: 'i3',
      ram_gb: 8,
      storage: '256GB',
      condition: 'Usado',
      purchase_price: 300,
      sale_price: 700,
      stock: 5,
      notes: '',
    }) as string;

    createSale({
      userId: 'seller-1',
      paymentMethod: 'EFECTIVO',
      subtotal: 1700,
      discount: 0,
      total: 1700,
      items: [
        { product_id: productId, qty: 1, unit_price: 700, line_total: 700 },
        { product_id: null, description: 'Servicio', qty: 1, unit_price: 1000, line_total: 1000, unit_cost: 200 },
      ],
    });

    db.prepare('INSERT INTO expenses (id,date,concept,amount,notes,created_at) VALUES (?,?,?,?,?,?)').run(
      'exp-1',
      '2025-01-10T12:30:00.000Z',
      'Gasto',
      100,
      '',
      '2025-01-10T12:30:00.000Z',
    );

    const summary = reportSummary('2025-01-10T00:00:00.000Z', '2025-01-10T23:59:59.999Z') as any;
    expect(summary.total_sales).toBe(1700);
    expect(summary.total_expenses).toBe(100);
    expect(summary.total_costs).toBe(500); // 300 product + 200 free item
  });

  test('reportTopProducts ignores free items and returns real products only', () => {
    const productId = upsertProduct({
      brand: 'Dell',
      model: 'Latitude',
      cpu: 'i5',
      ram_gb: 8,
      storage: '256GB',
      condition: 'Usado',
      purchase_price: 300,
      sale_price: 900,
      stock: 10,
      notes: '',
    }) as string;

    createSale({
      userId: 'seller-1',
      paymentMethod: 'EFECTIVO',
      subtotal: 1900,
      discount: 0,
      total: 1900,
      items: [
        { product_id: productId, qty: 2, unit_price: 900, line_total: 1800 },
        { product_id: null, description: 'Servicio', qty: 1, unit_price: 100, line_total: 100, unit_cost: 0 },
      ],
    });

    const top = reportTopProducts('2025-01-10T00:00:00.000Z', '2025-01-10T23:59:59.999Z') as any[];
    expect(top.length).toBe(1);
    expect(top[0].qty).toBe(2);
    expect(String(top[0].name)).toContain('Dell');
  });
});