import { API_CONFIG } from '../config/api.config';
import { Station } from '../types/station';
import { httpRequest } from './http.client';
import { mockStore, simulateLatency } from './mock.client';

export const stationService = {
  async getStations(): Promise<Station[]> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      return mockStore.getStations();
    }
    return httpRequest<Station[]>('/api/admin/stations');
  },

  async createStation(payload: Omit<Station, 'stationId'>): Promise<Station> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      const list = mockStore.getStations();
      const newId = Math.max(...list.map((s) => s.stationId), 0) + 1;
      const newStation: Station = { stationId: newId, ...payload };
      mockStore.setStations([...list, newStation]);

      mockStore.addAuditLog({
        userId: 7,
        action: 'CREATE',
        entityType: 'STATION',
        entityId: newId.toString(),
        oldValue: null,
        newValue: newStation,
      });

      return newStation;
    }

    return httpRequest<Station>('/api/admin/stations', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateStation(stationId: number, payload: Partial<Omit<Station, 'stationId'>>): Promise<Station> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      const list = mockStore.getStations();
      const idx = list.findIndex((s) => s.stationId === stationId);
      if (idx === -1) throw new Error(`Station with ID ${stationId} not found.`);

      const prev = { ...list[idx] };
      const updated: Station = { ...prev, ...payload };
      list[idx] = updated;
      mockStore.setStations([...list]);

      mockStore.addAuditLog({
        userId: 7,
        action: 'UPDATE',
        entityType: 'STATION',
        entityId: stationId.toString(),
        oldValue: prev,
        newValue: updated,
      });

      return updated;
    }

    return httpRequest<Station>(`/api/admin/stations/${stationId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async deleteStation(stationId: number): Promise<void> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      const list = mockStore.getStations();
      const target = list.find((s) => s.stationId === stationId);
      if (!target) throw new Error(`Station with ID ${stationId} not found.`);

      // Check if any train references this station
      const trains = mockStore.getTrains();
      const hasTrains = trains.some((t) => t.sourceStationId === stationId || t.destinationStationId === stationId);
      if (hasTrains) {
        throw new Error('Cannot delete station: Assigned as source or destination in active trains (Foreign key constraint).');
      }

      mockStore.setStations(list.filter((s) => s.stationId !== stationId));

      mockStore.addAuditLog({
        userId: 7,
        action: 'DELETE',
        entityType: 'STATION',
        entityId: stationId.toString(),
        oldValue: target,
        newValue: null,
      });

      return;
    }

    return httpRequest<void>(`/api/admin/stations/${stationId}`, {
      method: 'DELETE',
    });
  },
};
