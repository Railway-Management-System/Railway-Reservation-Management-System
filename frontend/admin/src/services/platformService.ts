import { API_CONFIG } from '../config/api.config';
import { Platform } from '../types/station';
import { httpRequest } from './http.client';
import { mockStore, simulateLatency } from './mock.client';

export const platformService = {
  async getPlatforms(stationId?: number): Promise<Platform[]> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      const list = mockStore.getPlatforms();
      return stationId ? list.filter((p) => p.stationId === stationId) : list;
    }

    const query = stationId ? `?stationId=${stationId}` : '';
    return httpRequest<Platform[]>(`/api/admin/platforms${query}`);
  },

  async createPlatform(payload: Omit<Platform, 'platformId'>): Promise<Platform> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      const list = mockStore.getPlatforms();
      const newId = Math.max(...list.map((p) => p.platformId), 0) + 1;
      const newPlatform: Platform = { platformId: newId, ...payload };
      mockStore.setPlatforms([...list, newPlatform]);

      mockStore.addAuditLog({
        userId: 7,
        action: 'CREATE',
        entityType: 'PLATFORM',
        entityId: newId.toString(),
        oldValue: null,
        newValue: newPlatform,
      });

      return newPlatform;
    }

    return httpRequest<Platform>('/api/admin/platforms', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updatePlatform(platformId: number, payload: Partial<Omit<Platform, 'platformId'>>): Promise<Platform> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      const list = mockStore.getPlatforms();
      const idx = list.findIndex((p) => p.platformId === platformId);
      if (idx === -1) throw new Error(`Platform with ID ${platformId} not found.`);

      const prev = { ...list[idx] };
      const updated: Platform = { ...prev, ...payload };
      list[idx] = updated;
      mockStore.setPlatforms([...list]);

      mockStore.addAuditLog({
        userId: 7,
        action: 'UPDATE',
        entityType: 'PLATFORM',
        entityId: platformId.toString(),
        oldValue: prev,
        newValue: updated,
      });

      return updated;
    }

    return httpRequest<Platform>(`/api/admin/platforms/${platformId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async deletePlatform(platformId: number): Promise<void> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      const list = mockStore.getPlatforms();
      const target = list.find((p) => p.platformId === platformId);
      if (!target) throw new Error(`Platform with ID ${platformId} not found.`);

      mockStore.setPlatforms(list.filter((p) => p.platformId !== platformId));

      mockStore.addAuditLog({
        userId: 7,
        action: 'DELETE',
        entityType: 'PLATFORM',
        entityId: platformId.toString(),
        oldValue: target,
        newValue: null,
      });

      return;
    }

    return httpRequest<void>(`/api/admin/platforms/${platformId}`, {
      method: 'DELETE',
    });
  },
};
