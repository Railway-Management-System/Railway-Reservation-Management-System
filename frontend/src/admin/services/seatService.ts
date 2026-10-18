import { API_CONFIG } from '../config/api.config';
import { Seat } from '../types/seat';
import { httpRequest } from './http.client';
import { mockStore, simulateLatency } from './mock.client';

export const seatService = {
  async getSeats(coachId?: number): Promise<Seat[]> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      const list = mockStore.getSeats();
      const filtered = coachId ? list.filter((s) => s.coachId === coachId) : list;
      return [...filtered].sort((a, b) => a.coachId - b.coachId || a.seatNumber - b.seatNumber);
    }

    const query = coachId ? `?coachId=${coachId}` : '';
    return httpRequest<Seat[]>(`/api/admin/seats${query}`);
  },

  async createSeat(payload: Omit<Seat, 'seatId'>): Promise<Seat> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      const list = mockStore.getSeats();
      const newId = Math.max(...list.map((s) => s.seatId), 0) + 1;
      const newSeat: Seat = { seatId: newId, ...payload };
      mockStore.setSeats([...list, newSeat]);

      mockStore.addAuditLog({
        userId: 7,
        action: 'CREATE',
        entityType: 'SEAT',
        entityId: newId.toString(),
        oldValue: null,
        newValue: newSeat,
      });

      return newSeat;
    }

    return httpRequest<Seat>('/api/admin/seats', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateSeat(seatId: number, payload: Partial<Omit<Seat, 'seatId'>>): Promise<Seat> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      const list = mockStore.getSeats();
      const idx = list.findIndex((s) => s.seatId === seatId);
      if (idx === -1) throw new Error(`Seat with ID ${seatId} not found.`);

      const prev = { ...list[idx] };
      const updated: Seat = { ...prev, ...payload };
      list[idx] = updated;
      mockStore.setSeats([...list]);

      mockStore.addAuditLog({
        userId: 7,
        action: 'UPDATE',
        entityType: 'SEAT',
        entityId: seatId.toString(),
        oldValue: prev,
        newValue: updated,
      });

      return updated;
    }

    return httpRequest<Seat>(`/api/admin/seats/${seatId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async deleteSeat(seatId: number): Promise<void> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      const list = mockStore.getSeats();
      const target = list.find((s) => s.seatId === seatId);
      if (!target) throw new Error(`Seat with ID ${seatId} not found.`);

      mockStore.setSeats(list.filter((s) => s.seatId !== seatId));

      mockStore.addAuditLog({
        userId: 7,
        action: 'DELETE',
        entityType: 'SEAT',
        entityId: seatId.toString(),
        oldValue: target,
        newValue: null,
      });

      return;
    }

    return httpRequest<void>(`/api/admin/seats/${seatId}`, {
      method: 'DELETE',
    });
  },
};
