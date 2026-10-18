export interface AuditLog {
  auditId: number;
  userId: number;
  action: string;
  entityType: string;
  entityId: string;
  oldValue: unknown;
  newValue: unknown;
  createdAt: string;
}
