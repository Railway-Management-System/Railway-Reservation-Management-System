import { API_CONFIG } from '../config/api.config';
import { httpRequest } from './http.client';
import { simulateLatency } from './mock.client';

export interface RefundRule {
  ruleId: number;
  minHours: number;
  maxHours: number | null;
  deductionPct: number;
  flatMinCharge: number;
  clerkage: number;
}

const MOCK_REFUND_RULES: RefundRule[] = [
  { ruleId: 1, minHours: 48, maxHours: null, deductionPct: 0, flatMinCharge: 240, clerkage: 60 },
  { ruleId: 2, minHours: 12, maxHours: 48, deductionPct: 25, flatMinCharge: 240, clerkage: 60 },
  { ruleId: 3, minHours: 4, maxHours: 12, deductionPct: 50, flatMinCharge: 240, clerkage: 60 },
  { ruleId: 4, minHours: 0, maxHours: 4, deductionPct: 100, flatMinCharge: 0, clerkage: 60 },
];

export const refundRuleService = {
  async getRefundRules(): Promise<RefundRule[]> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      return [...MOCK_REFUND_RULES];
    }
    return httpRequest<RefundRule[]>('/api/admin/refund-rules');
  },

  async getRefundRule(id: number): Promise<RefundRule> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      const r = MOCK_REFUND_RULES.find((x) => x.ruleId === id);
      if (!r) throw new Error(`Refund rule #${id} not found.`);
      return r;
    }
    return httpRequest<RefundRule>(`/api/admin/refund-rules/${id}`);
  },

  async createRefundRule(payload: Omit<RefundRule, 'ruleId'>): Promise<RefundRule> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      const newId = Math.max(...MOCK_REFUND_RULES.map((c) => c.ruleId), 0) + 1;
      const created: RefundRule = { ruleId: newId, ...payload };
      MOCK_REFUND_RULES.push(created);
      return created;
    }
    return httpRequest<RefundRule>('/api/admin/refund-rules', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateRefundRule(id: number, payload: Partial<Omit<RefundRule, 'ruleId'>>): Promise<RefundRule> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      const idx = MOCK_REFUND_RULES.findIndex((c) => c.ruleId === id);
      if (idx === -1) throw new Error(`Refund rule #${id} not found.`);
      const updated = { ...MOCK_REFUND_RULES[idx], ...payload };
      MOCK_REFUND_RULES[idx] = updated;
      return updated;
    }
    return httpRequest<RefundRule>(`/api/admin/refund-rules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async deleteRefundRule(id: number): Promise<void> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      const idx = MOCK_REFUND_RULES.findIndex((c) => c.ruleId === id);
      if (idx !== -1) MOCK_REFUND_RULES.splice(idx, 1);
      return;
    }
    return httpRequest<void>(`/api/admin/refund-rules/${id}`, {
      method: 'DELETE',
    });
  },
};
