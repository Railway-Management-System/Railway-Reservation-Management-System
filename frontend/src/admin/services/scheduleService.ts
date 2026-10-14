import { API_CONFIG } from '../config/api.config';
import { ScheduleStatus } from '../constants/enums';
import { Schedule } from '../types/schedule';
import { httpRequest } from './http.client';
import { mockStore, simulateLatency } from './mock.client';

export const scheduleService = {
  async getSchedules(trainId?: number, journeyDate?: string): Promise<Schedule[]> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      let list = mockStore.getSchedules();
      if (trainId) list = list.filter((s) => s.trainId === trainId);
      if (journeyDate) list = list.filter((s) => s.journeyDate === journeyDate);
      return [...list].sort((a, b) => b.journeyDate.localeCompare(a.journeyDate) || a.trainId - b.trainId);
    }

    const query = new URLSearchParams();
    if (trainId) query.append('trainId', trainId.toString());
    if (journeyDate) query.append('journeyDate', journeyDate);
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return httpRequest<Schedule[]>(`/api/admin/schedules${queryString}`);
  },

  async createSchedule(payload: Omit<Schedule, 'scheduleId'>): Promise<Schedule> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      const list = mockStore.getSchedules();
      const newId = Math.max(...list.map((s) => s.scheduleId), 0) + 1;
      const newSchedule: Schedule = { scheduleId: newId, ...payload };
      mockStore.setSchedules([...list, newSchedule]);

      mockStore.addAuditLog({
        userId: 7,
        action: 'CREATE',
        entityType: 'SCHEDULE',
        entityId: newId.toString(),
        oldValue: null,
        newValue: newSchedule,
      });

      return newSchedule;
    }

    return httpRequest<Schedule>('/api/admin/schedules', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateSchedule(scheduleId: number, payload: Partial<Omit<Schedule, 'scheduleId'>>): Promise<Schedule> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      const list = mockStore.getSchedules();
      const idx = list.findIndex((s) => s.scheduleId === scheduleId);
      if (idx === -1) throw new Error(`Schedule with ID ${scheduleId} not found.`);

      const prev = { ...list[idx] };
      const updated: Schedule = { ...prev, ...payload };
      list[idx] = updated;
      mockStore.setSchedules([...list]);

      mockStore.addAuditLog({
        userId: 7,
        action: 'UPDATE',
        entityType: 'SCHEDULE',
        entityId: scheduleId.toString(),
        oldValue: prev,
        newValue: updated,
      });

      return updated;
    }

    return httpRequest<Schedule>(`/api/admin/schedules/${scheduleId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async updateScheduleDelay(scheduleId: number, delayMinutes: number, status: ScheduleStatus): Promise<Schedule> {
    return this.updateSchedule(scheduleId, { delayMinutes, status });
  },

  async deleteSchedule(scheduleId: number): Promise<void> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      const list = mockStore.getSchedules();
      const target = list.find((s) => s.scheduleId === scheduleId);
      if (!target) throw new Error(`Schedule with ID ${scheduleId} not found.`);

      mockStore.setSchedules(list.filter((s) => s.scheduleId !== scheduleId));

      mockStore.addAuditLog({
        userId: 7,
        action: 'DELETE',
        entityType: 'SCHEDULE',
        entityId: scheduleId.toString(),
        oldValue: target,
        newValue: null,
      });

      return;
    }

    return httpRequest<void>(`/api/admin/schedules/${scheduleId}`, {
      method: 'DELETE',
    });
  },
};
