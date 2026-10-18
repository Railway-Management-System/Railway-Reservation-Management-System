import { API_CONFIG } from '../config/api.config';
import { QuotaRule } from '../types/quota';
import { httpRequest } from './http.client';
import { mockStore, simulateLatency } from './mock.client';

export const quotaService = {
  async getQuotas(): Promise<QuotaRule[]> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      return mockStore.getQuotas();
    }
    return httpRequest<QuotaRule[]>('/api/admin/quotas');
  },

  async updateQuota(quotaRuleId: number, payload: Partial<Omit<QuotaRule, 'quotaRuleId' | 'quota'>>): Promise<QuotaRule> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      const list = mockStore.getQuotas();
      const idx = list.findIndex((q) => q.quotaRuleId === quotaRuleId);
      if (idx === -1) throw new Error(`Quota rule with ID ${quotaRuleId} not found.`);

      const prev = { ...list[idx] };
      const updated: QuotaRule = { ...prev, ...payload };
      list[idx] = updated;
      mockStore.setQuotas([...list]);

      mockStore.addAuditLog({
        userId: 7,
        action: 'UPDATE',
        entityType: 'QUOTA',
        entityId: quotaRuleId.toString(),
        oldValue: prev,
        newValue: updated,
      });

      return updated;
    }

    return httpRequest<QuotaRule>(`/api/admin/quotas/${quotaRuleId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },
};
