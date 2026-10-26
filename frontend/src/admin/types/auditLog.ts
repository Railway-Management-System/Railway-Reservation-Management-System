export interface AuditLog {
  logId?: number;
  auditId?: number;
  userId: number;
  action: string;
  tableName?: string;
  entityType?: string;
  recordId?: string;
  entityId?: string;
  oldValue: unknown;
  newValue: unknown;
  loggedAt?: string;
  createdAt?: string;
}

