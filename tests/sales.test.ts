import { createSale, upsertProduct } from '../app/electron/db/queries';
import { insertUser, setupTestDb, teardownTestDb } from './helpers/testDb';

describe('sales createSale', () => {
  let db: ReturnType<typeof setupTestDb>;

  beforeEach(() => {
    db = setupTestDb();
    insertUser(db, 'seller-1');
  });

  afterEach(() => {
    teardownTestDb(db);
  });

  test('createSale with inventory item creates sale and decreases stock', () => {
    const productId = upsertProduct({
      brand: 'Acer',
      model: 'Nitro',
      cpu: 'i5',
      ram_gb: 16,
      storage: '512GB',
      condition: 'Nuevo',
      purchase_price: 100,
      sale_price: 200,
      stock: 5,
      notes: '',
    }) as string;

    const sale = createSale({
      userId: 'seller-1',
      paymentMethod: 'EFECTIVO',
      subtotal: 400,
      discount: 0,
      total: 400,
      items: [{ product_id: productId, qty: 2, unit_price: 200, line_total: 400 }],
    }) as any;

    expect(sale.saleId).toBeTruthy();
    const stock = db.prepare('SELECT stock FROM products WHERE id = ?').get(productId) as any;
    expect(stock.stock).toBe(3);
    const items = db.prepare('SELECT COUNT(*) as c FROM sale_items WHERE sale_id = ?').get(sale.saleId) as any;
    expect(items.c).toBe(1);
  });

  test('createSale stock insufficient throws and keeps stock unchanged', () => {
    const productId = upsertProduct({
      brand: 'Asus',
      model: 'Zenbook',
      cpu: 'i7',
      ram_gb: 16,
      storage: '512GB',
      condition: 'Nuevo',
      purchase_price: 100,
      sale_price: 200,
      stock: 1,
      notes: '',
    }) as string;

    expect(() =>
      createSale({
        userId: 'seller-1',
        paymentMethod: 'EFECTIVO',
        subtotal: 400,
        discount: 0,
        total: 400,
        items: [{ product_id: productId, qty: 2, unit_price: 200, line_total: 400 }],
      }),
    ).toThrow('Stock insuficiente');

    const stock = db.prepare('SELECT stock FROM products WHERE id = ?').get(productId) as any;
    expect(stock.stock).toBe(1);
  });

  test('createSale with free item inserts NULL product_id and does not touch products', () => {
    const sale = createSale({
      userId: 'seller-1',
      paymentMethod: 'EFECTIVO',
      subtotal: 50000,
      discount: 0,
      total: 50000,
      items: [{ product_id: null, description: 'Servicio', qty: 1, unit_price: 50000, line_total: 50000, unit_cost: 10000 }],
    }) as any;

    const freeItem = db.prepare('SELECT product_id, description, unit_cost FROM sale_items WHERE sale_id = ?').get(sale.saleId) as any;
    expect(freeItem.product_id).toBeNull();
    expect(freeItem.description).toBe('Servicio');
    expect(Number(freeItem.unit_cost)).toBe(10000);
  });

  test('createSale mixed items only updates inventory stock for product rows', () => {
    const productId = upsertProduct({
      brand: 'MSI',
      model: 'GF',
      cpu: 'i5',
      ram_gb: 8,
      storage: '256GB',
      condition: 'Usado',
      purchase_price: 50,
      sale_price: 100,
      stock: 4,
      notes: '',
    }) as string;

    createSale({
      userId: 'seller-1',
      paymentMethod: 'EFECTIVO',
      subtotal: 250,
      discount: 0,
      total: 250,
      items: [
        { product_id: productId, qty: 1, unit_price: 100, line_total: 100 },
        { product_id: null, description: 'Instalación', qty: 1, unit_price: 150, line_total: 150, unit_cost: 20 },
      ],
    });

    const stock = db.prepare('SELECT stock FROM products WHERE id = ?').get(productId) as any;
    expect(stock.stock).toBe(3);
  });
});
