import { API_CONFIG } from '../config/api.config';
import { AuditLog } from '../types/auditLog';
import { httpRequest } from './http.client';
import { mockStore, simulateLatency } from './mock.client';

export interface AuditLogFilters {
  entityType?: string;
  action?: string;
  userId?: number;
}

export const auditLogService = {
  async getAuditLogs(filters?: AuditLogFilters): Promise<AuditLog[]> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      let logs = mockStore.getAuditLogs();

      if (filters?.entityType) {
        logs = logs.filter((l) => l.entityType.toLowerCase() === filters.entityType!.toLowerCase());
      }
      if (filters?.action) {
        logs = logs.filter((l) => l.action.toLowerCase() === filters.action!.toLowerCase());
      }
      if (filters?.userId) {
        logs = logs.filter((l) => l.userId === filters.userId);
      }

      return [...logs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }

    const query = new URLSearchParams();
    if (filters?.entityType) query.append('entityType', filters.entityType);
    if (filters?.action) query.append('action', filters.action);
    if (filters?.userId) query.append('userId', filters.userId.toString());
    const queryString = query.toString() ? `?${query.toString()}` : '';

    return httpRequest<AuditLog[]>(`/api/admin/audit-logs${queryString}`);
  },
};
