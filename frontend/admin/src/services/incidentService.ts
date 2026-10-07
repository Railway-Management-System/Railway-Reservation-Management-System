// CONTRACT-GAP: see ADMIN_CONTRACT_GAPS.md
import { API_CONFIG } from '../config/api.config';
import { IncidentStatus } from '../constants/enums';
import { Incident } from '../types/incident';
import { mockStore, simulateLatency } from './mock.client';

export const incidentService = {
  async getIncidents(): Promise<Incident[]> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      return [...mockStore.getIncidents()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    // CONTRACT-GAP: endpoint GET /api/admin/incidents is not defined in the live API contract yet
    throw new Error('CONTRACT GAP: Endpoint GET /api/admin/incidents is pending in the backend contract.');
  },

  async updateIncidentStatus(incidentId: number, status: IncidentStatus): Promise<Incident> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      const list = mockStore.getIncidents();
      const idx = list.findIndex((i) => i.incidentId === incidentId);
      if (idx === -1) throw new Error(`Incident with ID ${incidentId} not found.`);

      const prev = { ...list[idx] };
      const updated: Incident = { ...prev, status };
      list[idx] = updated;
      mockStore.setIncidents([...list]);

      mockStore.addAuditLog({
        userId: 7,
        action: 'UPDATE',
        entityType: 'INCIDENT',
        entityId: incidentId.toString(),
        oldValue: { status: prev.status },
        newValue: { status },
      });

      return updated;
    }
    // CONTRACT-GAP: endpoint PUT /api/admin/incidents/:id is not defined in the live API contract yet
    throw new Error('CONTRACT GAP: Endpoint PUT /api/admin/incidents/:id is pending in the backend contract.');
  },
};
