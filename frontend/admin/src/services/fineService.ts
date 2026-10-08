// CONTRACT-GAP: see ADMIN_CONTRACT_GAPS.md
import { API_CONFIG } from '../config/api.config';
import { Fine } from '../types/fine';
import { mockStore, simulateLatency } from './mock.client';

export const fineService = {
  async getFines(): Promise<Fine[]> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      return [...mockStore.getFines()].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
    }
    // CONTRACT-GAP: endpoint GET /api/admin/fines is not defined in the live API contract yet
    throw new Error('CONTRACT GAP: Endpoint GET /api/admin/fines is pending in the backend contract.');
  },
};
