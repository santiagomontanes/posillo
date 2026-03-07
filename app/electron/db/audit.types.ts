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
  | 'EXPENSE_CREATE'
  | 'USER_CHANGE_PASSWORD';

export type AuditEntityType =
  | 'USER'
  | 'SALE'
  | 'CASH_SESSION'
  | 'PRODUCT'
  | 'BACKUP'
  | 'EXPENSE';