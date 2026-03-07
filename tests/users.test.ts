import { createUser, listUsers, listUsersBasic, resetUserPassword } from '../app/electron/db/queries';
import { setupTestDb, teardownTestDb } from './helpers/testDb';

describe('users queries', () => {
  let db: ReturnType<typeof setupTestDb>;

  beforeEach(() => {
    db = setupTestDb();
  });

  afterEach(() => {
    teardownTestDb(db);
  });

  test('createUser creates SELLER and listUsers omits password_hash', () => {
    const id = createUser({ name: 'Empleado', email: 'seller@test.com', password: 'Seller123*', role: 'SELLER' }) as string;
    expect(id).toBeTruthy();

    const users = listUsers() as any[];
    const seller = users.find((u) => u.email === 'seller@test.com');
    expect(seller).toBeTruthy();
    expect(seller.role).toBe('SELLER');
    expect(seller.password_hash).toBeUndefined();
  });

  test('createUser rejects duplicated email', () => {
    createUser({ name: 'One', email: 'dup@test.com', password: 'x', role: 'SELLER' });
    expect(() => createUser({ name: 'Two', email: 'dup@test.com', password: 'y', role: 'SELLER' })).toThrow('El email ya existe');
  });

  test('resetUserPassword updates stored hash', () => {
    const id = createUser({ name: 'Reset', email: 'reset@test.com', password: 'old', role: 'SELLER' }) as string;
    const before = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(id) as any;
    resetUserPassword({ id, newPassword: 'new-pass' });
    const after = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(id) as any;
    expect(after.password_hash).not.toBe(before.password_hash);
  });

  test('listUsersBasic returns minimal fields without password_hash', () => {
    createUser({ name: 'Basic', email: 'basic@test.com', password: 'x', role: 'SUPERVISOR' });
    const users = listUsersBasic() as any[];
    const user = users.find((u) => u.email === 'basic@test.com');
    expect(user).toBeTruthy();
    expect(user.created_at).toBeUndefined();
    expect(user.password_hash).toBeUndefined();
    expect(user.role).toBe('SUPERVISOR');
  });
});
