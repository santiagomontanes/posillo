import { requirePermission, type Permission, type Role } from '../../../shared/permissions';

export const getRoleFromPayload = (payload: unknown): Role | null => {
  const role = (payload as { role?: unknown } | null | undefined)?.role;
  if (role === 'ADMIN' || role === 'SUPERVISOR' || role === 'SELLER') return role;
  return null;
};

export const requirePermissionFromPayload = (payload: unknown, permission: Permission): Role => {
  const role = getRoleFromPayload(payload);
  if (!role) throw new Error('FORBIDDEN');
  requirePermission(role, permission);
  return role;
};
