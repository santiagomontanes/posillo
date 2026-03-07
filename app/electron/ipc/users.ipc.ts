import { ipcMain } from 'electron';
import { requirePermissionFromPayload } from './rbac';
import { readMySqlConfig } from '../db/mysqlConfig';

// ✅ TIPOS para auditoría (ajusta la ruta si tus tipos están en otro archivo)
import type { AuditLogAction, AuditEntityType } from '../db/queries';

// MySQL
import {
  createUserMySql,
  listUsersMySql,
  listUsersBasicMySql,
  resetUserPasswordMySql,
  changeUserPasswordMySql, // ✅ NUEVO
} from '../db/mysql/users.mysql';

import { logAuditMySql } from '../db/mysql/audit.mysql';

// SQLite fallback
import {
  createUser as createUserSqlite,
  listUsers as listUsersSqlite,
  listUsersBasic as listUsersBasicSqlite,
  resetUserPassword as resetUserPasswordSqlite,
  logAudit as logAuditSqlite,
  changeUserPassword as changeUserPasswordSqlite, // ✅ NUEVO
} from '../db/queries';

function hasMySqlConfig(): boolean {
  const cfg = readMySqlConfig();
  return !!(
    cfg &&
    String(cfg.host ?? '').trim() &&
    String(cfg.user ?? '').trim() &&
    String(cfg.database ?? '').trim()
  );
}

export const registerUsersIpc = (): void => {
  ipcMain.handle('users:list', async (_e, payload) => {
    requirePermissionFromPayload(payload, 'users:read');
    return hasMySqlConfig() ? await listUsersMySql() : listUsersSqlite();
  });

  ipcMain.handle('users:list-basic', async (_e, payload) => {
    requirePermissionFromPayload(payload, 'users:read');
    return hasMySqlConfig() ? await listUsersBasicMySql() : listUsersBasicSqlite();
  });

  ipcMain.handle('users:create', async (_e, payload) => {
    requirePermissionFromPayload(payload, 'users:write');

    const user = (payload as any)?.user ?? payload;
    const actorId = String((payload as any)?.userId ?? '');
    const useMySql = hasMySqlConfig();

    const id = useMySql ? await createUserMySql(user) : createUserSqlite(user);

    if (actorId) {
      const auditPayload: {
        actorId: string;
        action: AuditLogAction;
        entityType: AuditEntityType;
        entityId: string;
        metadata: any;
      } = {
        actorId,
        action: 'USER_CREATE',
        entityType: 'USER',
        entityId: id,
        metadata: { email: user?.email, role: user?.role },
      };

      try {
        if (useMySql) await logAuditMySql(auditPayload);
        else logAuditSqlite(auditPayload);
      } catch {}
    }

    return id;
  });

  ipcMain.handle('users:reset-password', async (_e, payload) => {
    requirePermissionFromPayload(payload, 'users:write');

    const data = (payload as any)?.data ?? payload;
    const actorId = String((payload as any)?.userId ?? '');
    const useMySql = hasMySqlConfig();

    if (useMySql) await resetUserPasswordMySql(data);
    else resetUserPasswordSqlite(data);

    if (actorId) {
      const targetId = String(data?.id ?? '');

      const auditPayload: {
        actorId: string;
        action: AuditLogAction;
        entityType: AuditEntityType;
        entityId: string;
        metadata: any;
      } = {
        actorId,
        action: 'USER_RESET_PASSWORD',
        entityType: 'USER',
        entityId: targetId,
        metadata: { targetUserId: targetId },
      };

      try {
        if (useMySql) await logAuditMySql(auditPayload);
        else logAuditSqlite(auditPayload);
      } catch {}
    }

    return { ok: true };
  });

  // ✅ NUEVO: cambio de contraseña (self-change o admin change)
  ipcMain.handle('users:change-password', async (_e, payload) => {
    const actorId = String((payload as any)?.userId ?? '');
    const data = (payload as any)?.data ?? payload;

    const targetId = String(data?.id ?? '');
    const currentPassword = data?.currentPassword != null ? String(data.currentPassword) : null;
    const newPassword = String(data?.newPassword ?? '');

    if (!actorId) throw new Error('No autenticado');
    if (!targetId) throw new Error('Usuario objetivo inválido');
    if (!newPassword || newPassword.length < 6) {
      throw new Error('La contraseña debe tener mínimo 6 caracteres');
    }

    // Si cambia a otro usuario => requiere permiso
    if (actorId !== targetId) requirePermissionFromPayload(payload, 'users:write');

    const useMySql = hasMySqlConfig();

    if (useMySql) {
      await changeUserPasswordMySql({ id: targetId, currentPassword, newPassword });
    } else {
      changeUserPasswordSqlite({ id: targetId, currentPassword, newPassword });
    }

    // ✅ auditoría (ya tipada correctamente)
    const auditPayload: {
      actorId: string;
      action: AuditLogAction;
      entityType: AuditEntityType;
      entityId: string;
      metadata: any;
    } = {
      actorId,
      action: 'USER_CHANGE_PASSWORD',
      entityType: 'USER',
      entityId: targetId,
      metadata: { targetUserId: targetId, self: actorId === targetId },
    };

    try {
      if (useMySql) await logAuditMySql(auditPayload);
      else logAuditSqlite(auditPayload);
    } catch {}

    return { ok: true };
  });
};