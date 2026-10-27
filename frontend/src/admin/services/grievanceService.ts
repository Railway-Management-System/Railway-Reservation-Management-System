import { isServiceMock } from '../config/api.config';
import { Grievance, GrievanceStatus } from '../types/grievance';
import { httpRequest } from './http.client';
import { mockStore, simulateLatency } from './mock.client';

export const grievanceService = {
  async getGrievances(status?: string): Promise<Grievance[]> {
    if (isServiceMock('grievances')) {
      await simulateLatency();
      let list = mockStore.getGrievances();
      if (status && status !== 'ALL') {
        list = list.filter((g) => g.status === status);
      }
      return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }

    const query = status && status !== 'ALL' ? `?status=${status}` : '';
    return httpRequest<Grievance[]>(`/api/admin/complaints${query}`);
  },

  async respondToGrievance(
    grievanceId: string | number,
    response: string,
    status: GrievanceStatus
  ): Promise<Grievance> {
    if (isServiceMock('grievances')) {
      await simulateLatency();
      const list = mockStore.getGrievances();
      const idx = list.findIndex((g) => String(g.grievanceId) === String(grievanceId));
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

    return httpRequest<Grievance>(`/api/admin/complaints/${encodeURIComponent(String(grievanceId))}`, {
      method: 'PUT',
      body: JSON.stringify({ response, status }),
    });
  },
};

