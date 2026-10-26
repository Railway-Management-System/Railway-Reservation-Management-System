import { API_CONFIG, isServiceMock } from '../config/api.config';
import { AuditLog } from '../types/auditLog';
import { httpRequest } from './http.client';
import { mockStore, simulateLatency } from './mock.client';

export interface AuditLogFilters {
  entityType?: string;
  tableName?: string;
  action?: string;
  userId?: number;
  page?: number;
  limit?: number;
}

export const auditLogService = {
  async getAuditLogs(filters?: AuditLogFilters): Promise<AuditLog[]> {
    if (isServiceMock('auditLogs')) {
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

      return [...logs].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    }

    const query = new URLSearchParams();
    if (filters?.tableName || filters?.entityType) {
      query.append('tableName', (filters.tableName || filters.entityType)!);
    }
    if (filters?.action) query.append('action', filters.action);
    if (filters?.userId) query.append('userId', filters.userId.toString());
    if (filters?.page) query.append('page', filters.page.toString());
    if (filters?.limit) query.append('limit', filters.limit.toString());
    const queryString = query.toString() ? `?${query.toString()}` : '';

    const data = await httpRequest<any[]>(`/api/admin/audit-logs${queryString}`);
    return data.map((item) => ({
      ...item,
      auditId: item.logId || item.auditId,
      entityType: item.tableName || item.entityType,
      entityId: String(item.recordId !== undefined ? item.recordId : item.entityId),
      createdAt: item.loggedAt || item.createdAt,
    }));
  },

  async getActivityLogs(filters?: { page?: number; limit?: number; userId?: number; action?: string }): Promise<any[]> {
    if (isServiceMock('auditLogs')) {
      await simulateLatency();
      return mockStore.getAuditLogs();
    }
    const query = new URLSearchParams();
    if (filters?.userId) query.append('userId', filters.userId.toString());
    if (filters?.action) query.append('action', filters.action);
    if (filters?.page) query.append('page', filters.page.toString());
    if (filters?.limit) query.append('limit', filters.limit.toString());
    const queryString = query.toString() ? `?${query.toString()}` : '';

    const data = await httpRequest<any[]>(`/api/admin/activity-logs${queryString}`);
    return data.map((item) => ({
      ...item,
      auditId: item.logId || item.auditId,
      entityType: item.tableName || item.entityType,
      entityId: String(item.recordId !== undefined ? item.recordId : item.entityId),
      createdAt: item.loggedAt || item.createdAt,
    }));
  },
};

