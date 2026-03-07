import { listProducts, updateProduct, upsertProduct } from '../app/electron/db/queries';
import { setupTestDb, teardownTestDb } from './helpers/testDb';

describe('products queries', () => {
  let db: ReturnType<typeof setupTestDb>;

  beforeEach(() => {
    db = setupTestDb();
  });

  afterEach(() => {
    teardownTestDb(db);
  });

  test('upsertProduct creates new product', () => {
    const id = upsertProduct({
      brand: 'Lenovo',
      model: 'ThinkPad',
      cpu: 'i5',
      ram_gb: 16,
      storage: '512GB',
      condition: 'Usado',
      purchase_price: 1000,
      sale_price: 1500,
      stock: 3,
      notes: '',
    }) as string;

    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as any;
    expect(row).toBeTruthy();
    expect(row.model).toBe('ThinkPad');
  });

  test('upsertProduct updates existing product by id', () => {
    const id = upsertProduct({
      brand: 'Dell',
      model: 'XPS',
      cpu: 'i7',
      ram_gb: 16,
      storage: '1TB',
      condition: 'Nuevo',
      purchase_price: 2000,
      sale_price: 2500,
      stock: 5,
      notes: '',
    }) as string;

    upsertProduct({
      id,
      brand: 'Dell',
      model: 'XPS',
      cpu: 'i7',
      ram_gb: 16,
      storage: '1TB',
      condition: 'Nuevo',
      purchase_price: 2000,
      sale_price: 2600,
      stock: 2,
      notes: 'updated',
    });

    const row = db.prepare('SELECT sale_price, stock FROM products WHERE id = ?').get(id) as any;
    expect(row.sale_price).toBe(2600);
    expect(row.stock).toBe(2);
  });

  test('updateProduct throws when id is missing', () => {
    expect(() => updateProduct({ model: 'NoID' })).toThrow('Missing product id');
  });

  test('updateProduct throws when no row is updated', () => {
    expect(() =>
      updateProduct({
        id: 'missing-id',
        brand: 'A',
        model: 'B',
        cpu: 'C',
        ram_gb: 8,
        storage: '256GB',
        condition: 'Usado',
        purchase_price: 1,
        sale_price: 2,
        stock: 1,
        notes: '',
      }),
    ).toThrow('Product not updated');
  });

  test('listProducts searches by brand/model/cpu', () => {
    upsertProduct({
      brand: 'HP',
      model: 'Elitebook',
      cpu: 'Ryzen 5',
      ram_gb: 8,
      storage: '256GB',
      condition: 'Usado',
      purchase_price: 500,
      sale_price: 900,
      stock: 4,
      notes: '',
    });

    expect((listProducts('HP') as any[]).length).toBeGreaterThan(0);
    expect((listProducts('Elitebook') as any[]).length).toBeGreaterThan(0);
    expect((listProducts('Ryzen') as any[]).length).toBeGreaterThan(0);
  });
});
