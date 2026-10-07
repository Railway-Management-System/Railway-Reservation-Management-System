// CONTRACT-GAP: see ADMIN_CONTRACT_GAPS.md
import { API_CONFIG } from '../config/api.config';
import { GrievanceStatus } from '../constants/enums';
import { Grievance } from '../types/grievance';
import { mockStore, simulateLatency } from './mock.client';

export const grievanceService = {
  async getGrievances(): Promise<Grievance[]> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      return [...mockStore.getGrievances()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    // In API_CONTRACT §6.2 GET /api/grievances is user-scoped; admin listing is a contract gap
    throw new Error('CONTRACT GAP: Admin listing endpoint GET /api/admin/grievances is pending in the contract.');
  },

  async respondToGrievance(
    grievanceId: number,
    response: string,
    status: GrievanceStatus
  ): Promise<Grievance> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      const list = mockStore.getGrievances();
      const idx = list.findIndex((g) => g.grievanceId === grievanceId);
      if (idx === -1) throw new Error(`Grievance with ID ${grievanceId} not found.`);

      const prev = { ...list[idx] };
      const updated: Grievance = {
        ...prev,
        response,
        status,
      };
      list[idx] = updated;
      mockStore.setGrievances([...list]);

      mockStore.addAuditLog({
        userId: 7,
        action: 'UPDATE',
        entityType: 'GRIEVANCE',
        entityId: grievanceId.toString(),
        oldValue: { status: prev.status, response: prev.response },
        newValue: { status, response },
      });

      return updated;
    }
    throw new Error('CONTRACT GAP: Endpoint PUT /api/admin/grievances/:id is pending in the backend contract.');
  },
};
