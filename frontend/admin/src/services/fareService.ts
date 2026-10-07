import { API_CONFIG } from '../config/api.config';
import { FareRule } from '../types/fare';
import { httpRequest } from './http.client';
import { mockStore, simulateLatency } from './mock.client';

export const fareService = {
  async getFares(): Promise<FareRule[]> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      return mockStore.getFares();
    }
    return httpRequest<FareRule[]>('/api/admin/fares');
  },

  async updateFare(fareId: number, payload: Partial<Omit<FareRule, 'fareId' | 'classType'>>): Promise<FareRule> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      const list = mockStore.getFares();
      const idx = list.findIndex((f) => f.fareId === fareId);
      if (idx === -1) throw new Error(`Fare rule with ID ${fareId} not found.`);

      const prev = { ...list[idx] };
      const updated: FareRule = { ...prev, ...payload };
      list[idx] = updated;
      mockStore.setFares([...list]);

      mockStore.addAuditLog({
        userId: 7,
        action: 'UPDATE',
        entityType: 'FARE',
        entityId: fareId.toString(),
        oldValue: prev,
        newValue: updated,
      });

      return updated;
    }

    return httpRequest<FareRule>(`/api/admin/fares/${fareId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },
};
