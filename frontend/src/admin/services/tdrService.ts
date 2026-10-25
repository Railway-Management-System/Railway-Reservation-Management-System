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
      return [...filtered].sort((a, b) => ((b.filedAt || b.submittedAt || '')).localeCompare(a.filedAt || a.submittedAt || ''));
    }

    const query = status && (status as string) !== 'ALL' ? `?status=${status}` : '';
    const data = await httpRequest<any[]>(`/api/admin/tdr${query}`);
    return data.map((item) => ({
      ...item,
      tdrRefNo: item.tdrRefNo || `TDR-${item.tdrId}`,
      submittedAt: item.filedAt || item.submittedAt,
    }));
  },

  async adjudicateTdr(
    tdrRefNo: string,
    status: TdrStatus,
    refundAmount?: number | null,
    remarks?: string | null
  ): Promise<any> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      const list = mockStore.getTdr();
      const idx = list.findIndex((t) => (t.tdrRefNo === tdrRefNo || String(t.tdrId) === tdrRefNo));
      if (idx === -1) throw new Error(`TDR claim with ID ${tdrRefNo} not found.`);

      const prev = { ...list[idx] };
      const updated: TdrClaim = {
        ...prev,
        status,
        refundAmount: refundAmount !== undefined ? refundAmount : prev.refundAmount,
        remarks: remarks || prev.remarks,
      };

      list[idx] = updated;
      mockStore.setTdr([...list]);

      mockStore.addAuditLog({
        userId: 7,
        action: status === 'APPROVED' ? 'APPROVE_TDR' : 'REJECT_TDR',
        entityType: 'TDR',
        entityId: tdrRefNo,
        oldValue: { status: prev.status, refundAmount: prev.refundAmount },
        newValue: { status, refundAmount },
      });

      return updated;
    }

    return httpRequest<{
      tdrRefNo: string;
      status: string;
      refundAmount: number;
      refund: any;
      gatewayRefund?: string;
    }>(`/api/admin/tdr/${encodeURIComponent(tdrRefNo)}`, {
      method: 'PUT',
      body: JSON.stringify({
        status,
        ...(status === 'APPROVED' && refundAmount !== undefined && refundAmount !== null ? { refundAmount: Number(refundAmount) } : {}),
        remarks: remarks || null
      }),
    });
  },
};

