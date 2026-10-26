import { API_CONFIG, isServiceMock } from '../config/api.config';
import { ScheduleStatus } from '../constants/enums';
import { Schedule } from '../types/schedule';
import { httpRequest } from './http.client';
import { mockStore, simulateLatency } from './mock.client';

export const scheduleService = {
  async getSchedules(
    filters?: {
      from_date?: string;
      to_date?: string;
      train_no?: string;
      limit?: number;
    } | number,
    journeyDate?: string
  ): Promise<Schedule[]> {
    let resolvedFilters: {
      from_date?: string;
      to_date?: string;
      train_no?: string;
      limit?: number;
    } = {};

    if (typeof filters === 'number') {
      resolvedFilters = {
        train_no: String(filters),
        from_date: journeyDate,
        to_date: journeyDate,
      };
    } else if (filters && typeof filters === 'object') {
      resolvedFilters = filters;
    }

    if (isServiceMock('schedules')) {
      await simulateLatency();
      let list = mockStore.getSchedules();
      if (resolvedFilters.train_no) {
        list = list.filter((s) => s.trainNumber === resolvedFilters.train_no || s.trainId?.toString() === resolvedFilters.train_no);
      }
      if (resolvedFilters.from_date) {
        list = list.filter((s) => s.journeyDate >= resolvedFilters.from_date!);
      }
      if (resolvedFilters.to_date) {
        list = list.filter((s) => s.journeyDate <= resolvedFilters.to_date!);
      }
      return [...list].sort((a, b) => b.journeyDate.localeCompare(a.journeyDate) || (a.trainId || 0) - (b.trainId || 0));
    }

    const query = new URLSearchParams();
    if (resolvedFilters.from_date) query.append('from_date', resolvedFilters.from_date);
    if (resolvedFilters.to_date) query.append('to_date', resolvedFilters.to_date);
    if (resolvedFilters.train_no) query.append('train_no', resolvedFilters.train_no);
    if (resolvedFilters.limit) query.append('limit', String(resolvedFilters.limit));

    const queryString = query.toString() ? `?${query.toString()}` : '';
    return await httpRequest<Schedule[]>(`/api/admin/schedules${queryString}`);
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

  async prepareChart(scheduleId: number): Promise<{
    scheduleId: number;
    status: string;
    trainNumber?: string;
    journeyDate?: string;
    chartPreparedAt?: string;
    alreadyPrepared?: boolean;
    totalWaitlistedPromoted?: number;
    totalRacPromoted?: number;
    totalConfirmed?: number;
    summary?: {
      activeHoldsCancelled: number;
      unusedQuotaSeatsReleased: number;
      autoUpgradesProcessed: number;
      oldClassPromotionsTriggered: number;
      waitlistedPassengersCancelled: number;
      totalRefundsDisbursed: number;
      chartSnapshotRowsPersisted: number;
    };
  }> {
    if (isServiceMock('chartPreparation')) {
      await simulateLatency();
      return {
        scheduleId,
        status: 'CHART_PREPARED',
        alreadyPrepared: false,
        summary: {
          activeHoldsCancelled: 1,
          unusedQuotaSeatsReleased: 4,
          autoUpgradesProcessed: 2,
          oldClassPromotionsTriggered: 2,
          waitlistedPassengersCancelled: 2,
          totalRefundsDisbursed: 1400.0,
          chartSnapshotRowsPersisted: 42,
        },
      };
    }

    let res: any;
    try {
      res = await httpRequest<any>(`/api/admin/schedules/${scheduleId}/chart-preparation`, {
        method: 'POST',
      });
    } catch (err: any) {
      if (err.status === 404) {
        res = await httpRequest<any>(`/api/schedules/${scheduleId}/chart-preparation`, {
          method: 'POST',
        });
      } else {
        throw err;
      }
    }

    return {
      scheduleId: res?.scheduleId || scheduleId,
      trainNumber: res?.trainNumber,
      journeyDate: res?.journeyDate,
      chartPreparedAt: res?.chartPreparedAt,
      status: 'CHART_PREPARED',
      summary: res?.summary || {
        activeHoldsCancelled: 0,
        unusedQuotaSeatsReleased: 0,
        autoUpgradesProcessed: 0,
        oldClassPromotionsTriggered: 0,
        waitlistedPassengersCancelled: 0,
        totalRefundsDisbursed: 0,
        chartSnapshotRowsPersisted: 0,
      },
    };
  },
};



