import { API_CONFIG, isServiceMock } from '../config/api.config';
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

export interface RankReportsResponse {
  busiestTrains: any[];
  topRoutes: any[];
  stationRanking: any[];
  classRevenue: any[];
  quotaUtilization: any[];
  reports?: { reportKey: string; name: string; data: any[] }[];
}


export const reportService = {
  async getDashboardMetrics(): Promise<DashboardMetrics> {
    await simulateLatency(50);
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

    return {
      totalBookings: bookings.length,
      totalRevenue,
      totalCancellations: cancellations.length,
      activeTrainsCount: trains.filter((t) => t.status === 'ACTIVE').length,
      openGrievancesCount: grievances.filter((g) => g.status === 'SUBMITTED' || g.status === 'IN_PROGRESS').length,
      pendingTdrCount: tdr.filter((t) => t.status === 'FILED' || t.status === 'UNDER_REVIEW').length,
      openIncidentsCount: incidents.filter((i) => i.status === 'REPORTED' || i.status === 'ACKNOWLEDGED').length,
      delayedTrainsCount: schedules.filter((s) => s.status === 'DELAYED').length,
    };
  },

  async getRevenueReport(): Promise<RevenueReportItem[]> {
    await simulateLatency(50);
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
  },

  async getBookingTrends(): Promise<BookingTrendItem[]> {
    await simulateLatency(50);
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
  },

  async getCancellationReport(): Promise<CancellationReportItem[]> {
    await simulateLatency(50);
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
  },

  async getOccupancyReport(): Promise<OccupancyReportItem[]> {
    await simulateLatency(50);
    const availabilities = mockStore.getAvailability();
    const trains = mockStore.getTrains();
    const tMap = new Map(trains.map((t) => [t.trainId, t]));

    return availabilities.map((a: any) => {
      const train = tMap.get(a.trainId);
      const total = 50;
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
  },

  async getFineSummary(): Promise<FineSummaryItem[]> {
    await simulateLatency(50);
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
  },

  async getDelayReport(): Promise<DelayPunctualityItem[]> {
    await simulateLatency(50);
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
  },

  async getComplaintsReport(): Promise<GrievanceMetricsItem[]> {
    await simulateLatency(50);
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
  },

  async getAnalyticalReport<T = any>(reportKey: string): Promise<{
    reportId: number;
    reportKey: string;
    reportType: string;
    generatedAt: string;
    rowCount: number;
    rows: T[];
  }> {
    return httpRequest(`/api/admin/reports/${reportKey}`);
  },

  async getRankReports(): Promise<RankReportsResponse> {
    if (isServiceMock('reports')) {
      await simulateLatency();
      return {
        busiestTrains: [
          { rank_pos: 1, dense_rank_pos: 1, train_id: 1, train_number: '12301', train_name: 'Howrah Rajdhani Express (12301)', train_type: 'RAJDHANI', total_runs_conducted: 6, total_passengers_booked: 850, total_revenue: 1733650.0 },
          { rank_pos: 2, dense_rank_pos: 2, train_id: 2, train_number: '12951', train_name: 'Mumbai Rajdhani Express (12951)', train_type: 'RAJDHANI', total_runs_conducted: 5, total_passengers_booked: 720, total_revenue: 1540000.0 },
          { rank_pos: 3, dense_rank_pos: 3, train_id: 3, train_number: '12002', train_name: 'Bhopal Shatabdi Express (12002)', train_type: 'SHATABDI', total_runs_conducted: 7, total_passengers_booked: 690, total_revenue: 980000.0 },
        ],
        topRoutes: [
          { revenue_rank: 1, origin_code: 'HWH', origin_station: 'Howrah Jn', destination_code: 'NDLS', destination_station: 'New Delhi', total_bookings_count: 420, gross_route_revenue: 890000.0, avg_fare_per_passenger: 2119.05 },
          { revenue_rank: 2, origin_code: 'MMCT', origin_station: 'Mumbai Central', destination_code: 'NDLS', destination_station: 'New Delhi', total_bookings_count: 380, gross_route_revenue: 812000.0, avg_fare_per_passenger: 2136.84 },
        ],
        stationRanking: [
          { station_rank: 1, station_id: 1, station_code: 'NDLS', station_name: 'New Delhi', city: 'New Delhi', state: 'Delhi', total_boarding_passengers: 1200, originating_revenue: 2400000.0 },
          { station_rank: 2, station_id: 2, station_code: 'HWH', station_name: 'Howrah Jn', city: 'Kolkata', state: 'West Bengal', total_boarding_passengers: 950, originating_revenue: 1950000.0 },
        ],
        classRevenue: [
          { class_code: '3A', class_name: 'AC 3 Tier', total_passengers: 600, class_revenue: 1200000.0, running_cumulative_revenue: 1200000.0, revenue_pct_share: 45.5 },
          { class_code: '2A', class_name: 'AC 2 Tier', total_passengers: 300, class_revenue: 900000.0, running_cumulative_revenue: 2100000.0, revenue_pct_share: 34.1 },
          { class_code: 'SL', class_name: 'Sleeper', total_passengers: 500, class_revenue: 537300.0, running_cumulative_revenue: 2637300.0, revenue_pct_share: 20.4 },
        ],
        quotaUtilization: [
          { quota: 'GENERAL', total_bookings: 500, total_passengers: 750, total_fare_collected: 1500000.0, avg_passenger_fare: 2000.0, quota_popularity_rank: 1 },
          { quota: 'TATKAL', total_bookings: 180, total_passengers: 240, total_fare_collected: 680000.0, avg_passenger_fare: 2833.33, quota_popularity_rank: 2 },
          { quota: 'LADIES', total_bookings: 50, total_passengers: 60, total_fare_collected: 120000.0, avg_passenger_fare: 2000.0, quota_popularity_rank: 3 },
        ],
      };
    }
    return httpRequest<RankReportsResponse>('/api/admin/reports/rank');
  },
};

