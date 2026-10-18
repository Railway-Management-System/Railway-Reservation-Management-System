export interface RevenueReportItem {
  trainNumber: string;
  trainName: string;
  classType: string;
  ticketCount: number;
  totalRevenue: number;
  period: string;
}

export interface BookingTrendItem {
  date: string;
  totalBookings: number;
  confirmedCount: number;
  racCount: number;
  waitingListCount: number;
  cancelledCount: number;
}

export interface CancellationReportItem {
  pnr: string;
  trainNumber: string;
  cancellationDate: string;
  cancellationCharge: number;
  refundAmount: number;
  status: string;
}

export interface OccupancyReportItem {
  trainNumber: string;
  trainName: string;
  journeyDate: string;
  classType: string;
  totalCapacity: number;
  bookedSeats: number;
  occupancyPercentage: number;
}

export interface FineSummaryItem {
  fineId: number;
  trainNumber: string;
  reason: string;
  amount: number;
  paymentStatus: string;
  issuedAt: string;
}

export interface DelayPunctualityItem {
  trainNumber: string;
  trainName: string;
  journeyDate: string;
  status: string;
  delayMinutes: number;
}

export interface GrievanceMetricsItem {
  category: string;
  totalCount: number;
  resolvedCount: number;
  inProgressCount: number;
  avgResolutionDays: number;
}

export interface DashboardMetrics {
  totalBookings: number;
  totalRevenue: number;
  totalCancellations: number;
  activeTrainsCount: number;
  openGrievancesCount: number;
  pendingTdrCount: number;
  openIncidentsCount: number;
  delayedTrainsCount: number;
}
