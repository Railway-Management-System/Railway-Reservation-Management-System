import { API_CONFIG } from '../config/api.config';
import { Coach } from '../types/coach';
import { httpRequest } from './http.client';
import { mockStore, simulateLatency } from './mock.client';

export const coachService = {
  async getCoaches(trainId?: number): Promise<Coach[]> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      const list = mockStore.getCoaches();
      return trainId ? list.filter((c) => c.trainId === trainId) : list;
    }

    const query = trainId ? `?trainId=${trainId}` : '';
    return httpRequest<Coach[]>(`/api/admin/coaches${query}`);
  },

  async createCoach(payload: Omit<Coach, 'coachId'>): Promise<Coach> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      const list = mockStore.getCoaches();
      const newId = Math.max(...list.map((c) => c.coachId), 0) + 1;
      const newCoach: Coach = { coachId: newId, ...payload };
      mockStore.setCoaches([...list, newCoach]);

      mockStore.addAuditLog({
        userId: 7,
        action: 'CREATE',
        entityType: 'COACH',
        entityId: newId.toString(),
        oldValue: null,
        newValue: newCoach,
      });

      return newCoach;
    }

    return httpRequest<Coach>('/api/admin/coaches', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateCoach(coachId: number, payload: Partial<Omit<Coach, 'coachId'>>): Promise<Coach> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      const list = mockStore.getCoaches();
      const idx = list.findIndex((c) => c.coachId === coachId);
      if (idx === -1) throw new Error(`Coach with ID ${coachId} not found.`);

      const prev = { ...list[idx] };
      const updated: Coach = { ...prev, ...payload };
      list[idx] = updated;
      mockStore.setCoaches([...list]);

      mockStore.addAuditLog({
        userId: 7,
        action: 'UPDATE',
        entityType: 'COACH',
        entityId: coachId.toString(),
        oldValue: prev,
        newValue: updated,
      });

      return updated;
    }

    return httpRequest<Coach>(`/api/admin/coaches/${coachId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async deleteCoach(coachId: number): Promise<void> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      const list = mockStore.getCoaches();
      const target = list.find((c) => c.coachId === coachId);
      if (!target) throw new Error(`Coach with ID ${coachId} not found.`);

      mockStore.setCoaches(list.filter((c) => c.coachId !== coachId));

      mockStore.addAuditLog({
        userId: 7,
        action: 'DELETE',
        entityType: 'COACH',
        entityId: coachId.toString(),
        oldValue: target,
        newValue: null,
      });

      return;
    }

    return httpRequest<void>(`/api/admin/coaches/${coachId}`, {
      method: 'DELETE',
    });
  },
};
