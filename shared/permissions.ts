export type Role = 'ADMIN' | 'SUPERVISOR' | 'SELLER';

export type Permission =
  | 'pos:sell'
  | 'sales:read:own'
  | 'sales:read:all'
  | 'cash:openclose'
  | 'cash:read'
  | 'users:read'
  | 'users:write'
  | 'reports:read'
  | 'inventory:read'
  | 'inventory:write'
  | 'audit:read'
  | 'expenses:read'
  | 'expenses:write'
  | 'backup:write'
  | 'config:write';

const allPermissions: Permission[] = [
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
  'expenses:read',
  'expenses:write',
  'backup:write',
  'config:write',

];

export type AuditLogAction =
  | 'USER_CREATE'
  | 'USER_RESET_PASSWORD'
  | 'SALE_CREATE'
  | 'SALE_VOID'
  | 'CASH_OPEN'
  | 'CASH_CLOSE'
  | 'PRODUCT_SAVE'
  | 'PRODUCT_UPDATE'
  | 'PRODUCT_DELETE'
  | 'BACKUP_CREATE'
  | 'EXPENSE_CREATE';

export type AuditEntityType =
  | 'USER'
  | 'SALE'
  | 'CASH_SESSION'
  | 'PRODUCT'
  | 'BACKUP'
  | 'EXPENSE';

export const rolePermissions = (role: Role): Set<Permission> => {
  if (role === 'ADMIN') return new Set(allPermissions);

  if (role === 'SUPERVISOR') {
    return new Set([
      'pos:sell',
      'sales:read:all',
      'cash:openclose',
      'cash:read',
      'reports:read',
      'inventory:read',
      'inventory:write',
      'expenses:read',
      'expenses:write',
      'backup:write',
    ]);
  }

  // SELLER
  return new Set([
    'pos:sell',
    'sales:read:own',
    'expenses:read',
    'expenses:write',
  ]);
};

export const can = (role: Role, permission: Permission): boolean =>
  rolePermissions(role).has(permission);

export const requirePermission = (role: Role, permission: Permission): void => {
  if (!can(role, permission)) throw new Error('FORBIDDEN');
};