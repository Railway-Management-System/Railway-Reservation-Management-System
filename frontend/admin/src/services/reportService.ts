import { API_CONFIG } from '../config/api.config';
import {
  BookingTrendItem,
  CancellationReportItem,
  DashboardMetrics,
  DelayPunctualityItem,
  FineSummaryItem,
  GrievanceMetricsItem,
  OccupancyReportItem,
  RevenueReportItem,
} from '../types/report';
import { httpRequest } from './http.client';
import { mockStore, simulateLatency } from './mock.client';

export const reportService = {
  async getDashboardMetrics(): Promise<DashboardMetrics> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency(150);
      const bookings = mockStore.getBookings();
      const payments = mockStore.getPayments();
      const cancellations = mockStore.getCancellations();
      const trains = mockStore.getTrains();
      const grievances = mockStore.getGrievances();
      const tdr = mockStore.getTdr();
      const incidents = mockStore.getIncidents();
      const schedules = mockStore.getSchedules();

      const totalRevenue = payments
        .filter((p) => p.paymentStatus === 'SUCCESS')
        .reduce((sum, p) => sum + p.amount, 0);

      const activeTrainsCount = trains.filter((t) => t.status === 'ACTIVE').length;
      const openGrievancesCount = grievances.filter((g) => g.status === 'SUBMITTED' || g.status === 'IN_PROGRESS').length;
      const pendingTdrCount = tdr.filter((t) => t.status === 'FILED' || t.status === 'UNDER_REVIEW').length;
      const openIncidentsCount = incidents.filter((i) => i.status === 'REPORTED' || i.status === 'ACKNOWLEDGED').length;
      const delayedTrainsCount = schedules.filter((s) => s.status === 'DELAYED').length;

      return {
        totalBookings: bookings.length,
        totalRevenue,
        totalCancellations: cancellations.length,
        activeTrainsCount,
        openGrievancesCount,
        pendingTdrCount,
        openIncidentsCount,
        delayedTrainsCount,
      };
    }

    // In live mode, compute from endpoints or get summary
    return httpRequest<DashboardMetrics>('/api/admin/reports/dashboard-summary');
  },

  async getRevenueReport(): Promise<RevenueReportItem[]> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      const bookings = mockStore.getBookings();
      const trains = mockStore.getTrains();
      const trainMap = new Map(trains.map((t) => [t.trainId, t]));

      const revenueMap = new Map<string, RevenueReportItem>();

      bookings.forEach((b) => {
        if (b.bookingStatus === 'CONFIRMED' || b.bookingStatus === 'RAC' || b.bookingStatus === 'WAITING_LIST') {
          const train = trainMap.get(b.trainId);
          const key = `${b.trainId}_${b.classType}`;
          const current = revenueMap.get(key) || {
            trainNumber: train?.trainNumber || `${b.trainId}`,
            trainName: train?.trainName || 'Unknown Train',
            classType: b.classType,
            ticketCount: 0,
            totalRevenue: 0,
            period: 'Oct 2026',
          };
          current.ticketCount += 1;
          current.totalRevenue += b.totalFare;
          revenueMap.set(key, current);
        }
      });

      return Array.from(revenueMap.values());
    }

    return httpRequest<RevenueReportItem[]>('/api/admin/reports/revenue');
  },

  async getBookingTrends(): Promise<BookingTrendItem[]> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      const bookings = mockStore.getBookings();
      const map = new Map<string, BookingTrendItem>();

      bookings.forEach((b) => {
        const date = b.journeyDate;
        const current = map.get(date) || {
          date,
          totalBookings: 0,
          confirmedCount: 0,
          racCount: 0,
          waitingListCount: 0,
          cancelledCount: 0,
        };
        current.totalBookings += 1;
        if (b.bookingStatus === 'CONFIRMED') current.confirmedCount += 1;
        else if (b.bookingStatus === 'RAC') current.racCount += 1;
        else if (b.bookingStatus === 'WAITING_LIST') current.waitingListCount += 1;
        else if (b.bookingStatus === 'CANCELLED') current.cancelledCount += 1;
        map.set(date, current);
      });

      return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
    }

    return httpRequest<BookingTrendItem[]>('/api/admin/reports/bookings');
  },

  async getCancellationReport(): Promise<CancellationReportItem[]> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      const cancellations = mockStore.getCancellations();
      const bookings = mockStore.getBookings();
      const trains = mockStore.getTrains();
      const bMap = new Map(bookings.map((b) => [b.bookingId, b]));
      const tMap = new Map(trains.map((t) => [t.trainId, t]));

      return cancellations.map((c) => {
        const booking = bMap.get(c.bookingId);
        const train = booking ? tMap.get(booking.trainId) : null;
        return {
          pnr: booking ? booking.pnr : 'UNKNOWN',
          trainNumber: train ? train.trainNumber : 'N/A',
          cancellationDate: c.cancellationDate,
          cancellationCharge: c.cancellationCharge,
          refundAmount: c.refundAmount,
          status: c.status,
        };
      });
    }

    return httpRequest<CancellationReportItem[]>('/api/admin/reports/cancellations');
  },

  async getOccupancyReport(): Promise<OccupancyReportItem[]> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      const availabilities = mockStore.getAvailability();
      const trains = mockStore.getTrains();
      const tMap = new Map(trains.map((t) => [t.trainId, t]));

      return availabilities.map((a: any) => {
        const train = tMap.get(a.trainId);
        const total = 50; // nominal class capacity for mock calculation
        const booked = Math.max(0, total - a.availableSeats);
        const occupancyPercentage = Math.round((booked / total) * 100);

        return {
          trainNumber: train?.trainNumber || `${a.trainId}`,
          trainName: train?.trainName || 'Unknown Train',
          journeyDate: a.journeyDate,
          classType: a.classType,
          totalCapacity: total,
          bookedSeats: booked,
          occupancyPercentage,
        };
      });
    }

    return httpRequest<OccupancyReportItem[]>('/api/admin/reports/occupancy');
  },

  async getFineSummary(): Promise<FineSummaryItem[]> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      const fines = mockStore.getFines();
      const trains = mockStore.getTrains();
      const tMap = new Map(trains.map((t) => [t.trainId, t]));

      return fines.map((f) => {
        const train = f.trainId ? tMap.get(f.trainId) : null;
        return {
          fineId: f.fineId,
          trainNumber: train ? train.trainNumber : 'Station Offense',
          reason: f.reason,
          amount: f.amount,
          paymentStatus: f.paymentStatus,
          issuedAt: f.issuedAt,
        };
      });
    }

    return httpRequest<FineSummaryItem[]>('/api/admin/reports/fines');
  },

  async getDelayReport(): Promise<DelayPunctualityItem[]> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      const schedules = mockStore.getSchedules();
      const trains = mockStore.getTrains();
      const tMap = new Map(trains.map((t) => [t.trainId, t]));

      return schedules.map((s) => {
        const train = tMap.get(s.trainId);
        return {
          trainNumber: train ? train.trainNumber : `${s.trainId}`,
          trainName: train ? train.trainName : 'Unknown Train',
          journeyDate: s.journeyDate,
          status: s.status,
          delayMinutes: s.delayMinutes,
        };
      });
    }

    return httpRequest<DelayPunctualityItem[]>('/api/admin/reports/delays');
  },

  async getComplaintsReport(): Promise<GrievanceMetricsItem[]> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      const grievances = mockStore.getGrievances();
      const map = new Map<string, GrievanceMetricsItem>();

      grievances.forEach((g) => {
        const cat = g.category;
        const current = map.get(cat) || {
          category: cat,
          totalCount: 0,
          resolvedCount: 0,
          inProgressCount: 0,
          avgResolutionDays: 1.5,
        };
        current.totalCount += 1;
        if (g.status === 'RESOLVED') current.resolvedCount += 1;
        else if (g.status === 'IN_PROGRESS' || g.status === 'SUBMITTED') current.inProgressCount += 1;
        map.set(cat, current);
      });

      return Array.from(map.values());
    }

    return httpRequest<GrievanceMetricsItem[]>('/api/admin/reports/complaints');
  },
};
