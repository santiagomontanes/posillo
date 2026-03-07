import { listAuditLogs, logAudit } from '../app/electron/db/queries';
import { setupTestDb, teardownTestDb, insertUser } from './helpers/testDb';

describe('audit logs', () => {
  let db: ReturnType<typeof setupTestDb>;

  beforeEach(() => {
    db = setupTestDb();
    insertUser(db, 'admin-1');
  });

  afterEach(() => {
    teardownTestDb(db);
  });

  test('logAudit inserts row with metadata JSON', () => {
    const id = logAudit({
      actorId: 'admin-1',
      action: 'USER_CREATE',
      entityType: 'USER',
      entityId: 'user-2',
      metadata: { email: 'seller@test.com', role: 'SELLER' },
    });

    const row = db.prepare('SELECT * FROM audit_logs WHERE id = ?').get(id) as any;
    expect(row.actor_user_id).toBe('admin-1');
    expect(row.action).toBe('USER_CREATE');
    expect(row.entity_type).toBe('USER');
    expect(row.entity_id).toBe('user-2');
    expect(JSON.parse(row.metadata)).toMatchObject({ email: 'seller@test.com', role: 'SELLER' });
  });

  test('listAuditLogs filters by action and actor', () => {
    logAudit({ actorId: 'admin-1', action: 'CASH_OPEN', entityType: 'CASH_SESSION', entityId: 'cash-1' });
    logAudit({ actorId: 'admin-1', action: 'SALE_CREATE', entityType: 'SALE', entityId: 'sale-1' });

    const items = listAuditLogs({
      from: '2020-01-01T00:00:00.000Z',
      to: '2030-01-01T00:00:00.000Z',
      actorId: 'admin-1',
      action: 'SALE_CREATE',
      limit: 20,
      offset: 0,
    }) as any[];

    expect(items).toHaveLength(1);
    expect(items[0].action).toBe('SALE_CREATE');
    expect(items[0].entity_type).toBe('SALE');
  });
});
