// CONTRACT-GAP: see ADMIN_CONTRACT_GAPS.md
import { API_CONFIG } from '../config/api.config';
import { CleanlinessReport } from '../types/cleanlinessReport';
import { CrowdReport } from '../types/crowdReport';
import { mockStore, simulateLatency } from './mock.client';

export const groundReportService = {
  async getCrowdReports(): Promise<CrowdReport[]> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      return [...mockStore.getCrowdReports()].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
    }
    throw new Error('CONTRACT GAP: Endpoint GET /api/admin/crowd-reports is pending in the backend contract.');
  },

  async getCleanlinessReports(): Promise<CleanlinessReport[]> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      return [...mockStore.getCleanlinessReports()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    throw new Error('CONTRACT GAP: Endpoint GET /api/admin/cleanliness-reports is pending in the backend contract.');
  },
};
