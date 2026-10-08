import { API_CONFIG } from '../config/api.config';
import { TdrStatus } from '../constants/enums';
import { TdrClaim } from '../types/tdr';
import { httpRequest } from './http.client';
import { mockStore, simulateLatency } from './mock.client';

export const tdrService = {
  async getTdrClaims(status?: TdrStatus): Promise<TdrClaim[]> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      const list = mockStore.getTdr();
      const filtered = status ? list.filter((t) => t.status === status) : list;
      return [...filtered].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
    }

    const query = status ? `?status=${status}` : '';
    return httpRequest<TdrClaim[]>(`/api/admin/tdr${query}`);
  },

  async adjudicateTdr(
    tdrId: number,
    status: TdrStatus,
    refundAmount?: number | null
  ): Promise<TdrClaim> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      const list = mockStore.getTdr();
      const idx = list.findIndex((t) => t.tdrId === tdrId);
      if (idx === -1) throw new Error(`TDR claim with ID ${tdrId} not found.`);

      const prev = { ...list[idx] };
      const updated: TdrClaim = {
        ...prev,
        status,
        refundAmount: refundAmount !== undefined ? refundAmount : prev.refundAmount,
      };

      list[idx] = updated;
      mockStore.setTdr([...list]);

      mockStore.addAuditLog({
        userId: 7,
        action: status === 'APPROVED' ? 'APPROVE_TDR' : 'REJECT_TDR',
        entityType: 'TDR',
        entityId: tdrId.toString(),
        oldValue: { status: prev.status, refundAmount: prev.refundAmount },
        newValue: { status, refundAmount },
      });

      return updated;
    }

    return httpRequest<TdrClaim>(`/api/admin/tdr/${tdrId}`, {
      method: 'PUT',
      body: JSON.stringify({ status, refundAmount }),
    });
  },
};
