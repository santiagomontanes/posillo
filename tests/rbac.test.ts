import { can, requirePermission, rolePermissions, type Permission } from '../shared/permissions';

describe('permissions RBAC', () => {
  test('SELLER permissions', () => {
    expect(can('SELLER', 'pos:sell')).toBe(true);
    expect(can('SELLER', 'sales:read:own')).toBe(true);
    expect(can('SELLER', 'inventory:write')).toBe(false);
    expect(can('SELLER', 'cash:read')).toBe(false);
  });

  test('SUPERVISOR permissions', () => {
    expect(can('SUPERVISOR', 'pos:sell')).toBe(true);
    expect(can('SUPERVISOR', 'sales:read:all')).toBe(true);
    expect(can('SUPERVISOR', 'cash:openclose')).toBe(true);
    expect(can('SUPERVISOR', 'reports:read')).toBe(true);
    expect(can('SUPERVISOR', 'users:write')).toBe(false);
  });

  test('ADMIN has all permissions', () => {
    const all: Permission[] = [
      'pos:sell',
      'sales:read:own',
      'sales:read:all',
      'cash:openclose',
      'cash:read',
      'users:read',
      'users:write',
      'reports:read',
      'inventory:read',
      'inventory:write',
      'audit:read',
      'config:write',
    ];

    for (const p of all) {
      expect(can('ADMIN', p)).toBe(true);
      expect(() => requirePermission('ADMIN', p)).not.toThrow();
    }
    expect(rolePermissions('ADMIN').size).toBe(all.length);
  });

  test('requirePermission throws FORBIDDEN when role cannot', () => {
    expect(() => requirePermission('SELLER', 'users:write')).toThrow('FORBIDDEN');
    expect(() => requirePermission('SUPERVISOR', 'inventory:write')).toThrow('FORBIDDEN');
  });
});
