import { API_CONFIG } from '../config/api.config';
import { httpRequest } from './http.client';
import { simulateLatency } from './mock.client';

export interface ConcessionRule {
  ruleId: number;
  concessionType: string;
  classId?: number;
  trainGroup: string;
  discountPct: number;
  proofTypes?: string[];
  isActive: boolean;
}

const MOCK_CONCESSIONS: ConcessionRule[] = [
  { ruleId: 1, concessionType: 'SENIOR_CITIZEN', classId: 1, trainGroup: 'MAIL_EXPRESS', discountPct: 40, isActive: true },
  { ruleId: 2, concessionType: 'SENIOR_CITIZEN', classId: 2, trainGroup: 'MAIL_EXPRESS', discountPct: 50, isActive: true },
  { ruleId: 3, concessionType: 'DIVYAANG', classId: 1, trainGroup: 'ALL', discountPct: 75, isActive: true },
  { ruleId: 4, concessionType: 'STUDENT', classId: 4, trainGroup: 'ORDINARY', discountPct: 50, isActive: true },
];

export const concessionRuleService = {
  async getConcessionRules(): Promise<ConcessionRule[]> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      return [...MOCK_CONCESSIONS];
    }
    return httpRequest<ConcessionRule[]>('/api/admin/concession-rules');
  },

  async getConcessionRule(id: number): Promise<ConcessionRule> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      const r = MOCK_CONCESSIONS.find((c) => c.ruleId === id);
      if (!r) throw new Error(`Concession rule #${id} not found.`);
      return r;
    }
    return httpRequest<ConcessionRule>(`/api/admin/concession-rules/${id}`);
  },

  async createConcessionRule(payload: Omit<ConcessionRule, 'ruleId'>): Promise<ConcessionRule> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      const newId = Math.max(...MOCK_CONCESSIONS.map((c) => c.ruleId), 0) + 1;
      const created: ConcessionRule = { ruleId: newId, ...payload };
      MOCK_CONCESSIONS.push(created);
      return created;
    }
    return httpRequest<ConcessionRule>('/api/admin/concession-rules', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateConcessionRule(id: number, payload: Partial<Omit<ConcessionRule, 'ruleId'>>): Promise<ConcessionRule> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      const idx = MOCK_CONCESSIONS.findIndex((c) => c.ruleId === id);
      if (idx === -1) throw new Error(`Concession rule #${id} not found.`);
      const updated = { ...MOCK_CONCESSIONS[idx], ...payload };
      MOCK_CONCESSIONS[idx] = updated;
      return updated;
    }
    return httpRequest<ConcessionRule>(`/api/admin/concession-rules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async deleteConcessionRule(id: number): Promise<void> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      const idx = MOCK_CONCESSIONS.findIndex((c) => c.ruleId === id);
      if (idx !== -1) MOCK_CONCESSIONS.splice(idx, 1);
      return;
    }
    return httpRequest<void>(`/api/admin/concession-rules/${id}`, {
      method: 'DELETE',
    });
  },
};
