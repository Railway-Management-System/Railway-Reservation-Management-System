import { API_CONFIG } from '../config/api.config';
import { RouteStop } from '../types/route';
import { httpRequest } from './http.client';
import { mockStore, simulateLatency } from './mock.client';

export const routeService = {
  async getRoutes(trainId?: number): Promise<RouteStop[]> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      const routes = mockStore.getRoutes();
      const filtered = trainId ? routes.filter((r) => r.trainId === trainId) : routes;
      return [...filtered].sort((a, b) => a.trainId - b.trainId || a.stopSequence - b.stopSequence);
    }

    const query = trainId ? `?trainId=${trainId}` : '';
    return httpRequest<RouteStop[]>(`/api/admin/routes${query}`);
  },

  async createRouteStop(payload: Omit<RouteStop, 'routeId'>): Promise<RouteStop> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      const list = mockStore.getRoutes();
      const newId = Math.max(...list.map((r) => r.routeId), 0) + 1;
      const newStop: RouteStop = { routeId: newId, ...payload };
      mockStore.setRoutes([...list, newStop]);

      mockStore.addAuditLog({
        userId: 7,
        action: 'CREATE',
        entityType: 'ROUTE',
        entityId: newId.toString(),
        oldValue: null,
        newValue: newStop,
      });

      return newStop;
    }

    return httpRequest<RouteStop>('/api/admin/routes', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateRouteStop(routeId: number, payload: Partial<Omit<RouteStop, 'routeId'>>): Promise<RouteStop> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      const list = mockStore.getRoutes();
      const idx = list.findIndex((r) => r.routeId === routeId);
      if (idx === -1) throw new Error(`Route stop with ID ${routeId} not found.`);

      const prev = { ...list[idx] };
      const updated: RouteStop = { ...prev, ...payload };
      list[idx] = updated;
      mockStore.setRoutes([...list]);

      mockStore.addAuditLog({
        userId: 7,
        action: 'UPDATE',
        entityType: 'ROUTE',
        entityId: routeId.toString(),
        oldValue: prev,
        newValue: updated,
      });

      return updated;
    }

    return httpRequest<RouteStop>(`/api/admin/routes/${routeId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async deleteRouteStop(routeId: number): Promise<void> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      const list = mockStore.getRoutes();
      const target = list.find((r) => r.routeId === routeId);
      if (!target) throw new Error(`Route stop with ID ${routeId} not found.`);

      mockStore.setRoutes(list.filter((r) => r.routeId !== routeId));

      mockStore.addAuditLog({
        userId: 7,
        action: 'DELETE',
        entityType: 'ROUTE',
        entityId: routeId.toString(),
        oldValue: target,
        newValue: null,
      });

      return;
    }

    return httpRequest<void>(`/api/admin/routes/${routeId}`, {
      method: 'DELETE',
    });
  },
};
