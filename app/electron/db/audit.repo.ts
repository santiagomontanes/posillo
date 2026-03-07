import { isMySqlEnabled } from './dbRouter';

// SQLite
import { logAudit, listAuditLogs } from './queries';

// MySQL
import { logAuditMySql, listAuditLogsMySql } from './mysql/audit.mysql';

import type { AuditEntityType, AuditLogAction } from './audit.types';

export const logAuditRepo = async (input: {
  actorId: string;
  action: AuditLogAction;
  entityType: AuditEntityType;
  entityId?: string | null;
  metadata?: unknown;
}): Promise<string> => {
  if (isMySqlEnabled()) return await logAuditMySql(input);
  return logAudit(input);
};

export const listAuditLogsRepo = async (filters: {
  from: string;
  to: string;
  actorId?: string;
  action?: AuditLogAction;
  limit?: number;
  offset?: number;
}): Promise<any[]> => {
  if (isMySqlEnabled()) return await listAuditLogsMySql(filters);
  return listAuditLogs(filters) as any[];
};