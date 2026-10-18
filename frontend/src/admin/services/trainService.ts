import { API_CONFIG } from '../config/api.config';
import { ClassType, Quota } from '../constants/enums';
import { Train, TrainDetail, TrainRouteStop } from '../types/train';
import { httpRequest } from './http.client';
import { mockStore, simulateLatency } from './mock.client';

export const trainService = {
  async getTrains(): Promise<Train[]> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      return mockStore.getTrains();
    }
    return httpRequest<Train[]>('/api/admin/trains');
  },

  async getTrainById(trainId: number): Promise<TrainDetail> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      const train = mockStore.getTrains().find((t) => t.trainId === trainId);
      if (!train) throw new Error(`Train with ID ${trainId} not found.`);

      const stations = mockStore.getStations();
      const stationMap = new Map(stations.map((s) => [s.stationId, s]));

      const rawRoutes = mockStore.getRoutes().filter((r) => r.trainId === trainId);
      rawRoutes.sort((a, b) => a.stopSequence - b.stopSequence);

      const route: TrainRouteStop[] = rawRoutes.map((r) => {
        const station = stationMap.get(r.stationId);
        return {
          routeId: r.routeId,
          stationId: r.stationId,
          stationCode: station ? station.stationCode : 'UNKNOWN',
          stationName: station ? station.stationName : 'Unknown Station',
          stopSequence: r.stopSequence,
          arrivalTime: r.arrivalTime,
          departureTime: r.departureTime,
          distanceFromOrigin: r.distanceFromOrigin,
          platformNumber: r.platformNumber,
        };
      });

      return {
        ...train,
        route,
      };
    }

    return httpRequest<TrainDetail>(`/api/trains/${trainId}`);
  },

  async createTrain(payload: Omit<Train, 'trainId'>): Promise<Train> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      const list = mockStore.getTrains();
      const newId = Math.max(...list.map((t) => t.trainId), 0) + 1;
      const newTrain: Train = { trainId: newId, ...payload };
      mockStore.setTrains([...list, newTrain]);

      mockStore.addAuditLog({
        userId: 7,
        action: 'CREATE',
        entityType: 'TRAIN',
        entityId: newId.toString(),
        oldValue: null,
        newValue: newTrain,
      });

      return newTrain;
    }

    return httpRequest<Train>('/api/admin/trains', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateTrain(trainId: number, payload: Partial<Omit<Train, 'trainId'>>): Promise<Train> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      const list = mockStore.getTrains();
      const idx = list.findIndex((t) => t.trainId === trainId);
      if (idx === -1) throw new Error(`Train with ID ${trainId} not found.`);

      const prev = { ...list[idx] };
      const updated: Train = { ...prev, ...payload };
      list[idx] = updated;
      mockStore.setTrains([...list]);

      mockStore.addAuditLog({
        userId: 7,
        action: 'UPDATE',
        entityType: 'TRAIN',
        entityId: trainId.toString(),
        oldValue: prev,
        newValue: updated,
      });

      return updated;
    }

    return httpRequest<Train>(`/api/admin/trains/${trainId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async deleteTrain(trainId: number): Promise<void> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      const list = mockStore.getTrains();
      const target = list.find((t) => t.trainId === trainId);
      if (!target) throw new Error(`Train with ID ${trainId} not found.`);

      // Check if bookings exist for this train
      const bookings = mockStore.getBookings();
      const hasActiveBookings = bookings.some(
        (b) => b.trainId === trainId && b.bookingStatus !== 'CANCELLED' && b.bookingStatus !== 'FAILED'
      );
      if (hasActiveBookings) {
        throw new Error('Cannot delete train: Active bookings exist for this service.');
      }

      mockStore.setTrains(list.filter((t) => t.trainId !== trainId));

      mockStore.addAuditLog({
        userId: 7,
        action: 'DELETE',
        entityType: 'TRAIN',
        entityId: trainId.toString(),
        oldValue: target,
        newValue: null,
      });

      return;
    }

    return httpRequest<void>(`/api/admin/trains/${trainId}`, {
      method: 'DELETE',
    });
  },

  async getTrainAvailability(
    trainId: number,
    journeyDate: string,
    classType?: ClassType,
    quota: Quota = 'GENERAL'
  ) {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      const availabilities = mockStore.getAvailability();
      const matches = availabilities.filter(
        (a: { trainId: number; journeyDate: string; classType: string; quota: string }) =>
          a.trainId === trainId &&
          a.journeyDate === journeyDate &&
          (!classType || a.classType === classType) &&
          a.quota === quota
      );

      if (matches.length > 0) {
        return matches;
      }

      // Default fallback mock availability snapshot
      return [
        {
          trainId,
          journeyDate,
          classType: classType || '3A',
          quota,
          availableSeats: 28,
          racCount: 6,
          waitingListCount: 0,
        },
      ];
    }

    const query = new URLSearchParams({ journeyDate, quota });
    if (classType) query.append('classType', classType);
    return httpRequest<any>(`/api/trains/${trainId}/availability?${query.toString()}`);
  },
};
