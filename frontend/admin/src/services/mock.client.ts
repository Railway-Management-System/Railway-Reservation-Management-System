import { API_CONFIG } from '../config/api.config';
import {
  User,
  Passenger,
  Staff,
  Station,
  Platform,
  Train,
  RouteStop,
  Schedule,
  Coach,
  Seat,
  FareRule,
  QuotaRule,
  Booking,
  BookingPassenger,
  Payment,
  Cancellation,
  TdrClaim,
  Notification,
  Grievance,
  Fine,
  Incident,
  CrowdReport,
  CleanlinessReport,
  AuditLog,
} from '../types';

import rawUsers from '../../../../mock-data/users.json';
import rawPassengers from '../../../../mock-data/passengers.json';
import rawStaff from '../../../../mock-data/staff.json';
import rawStations from '../../../../mock-data/stations.json';
import rawTrains from '../../../../mock-data/trains.json';
import rawRoutes from '../../../../mock-data/routes.json';
import rawSchedules from '../../../../mock-data/schedules.json';
import rawCoaches from '../../../../mock-data/coaches.json';
import rawSeats from '../../../../mock-data/seats.json';
import rawAvailability from '../../../../mock-data/availability.json';
import rawBookings from '../../../../mock-data/bookings.json';
import rawBookingPassengers from '../../../../mock-data/booking-passengers.json';
import rawPayments from '../../../../mock-data/payments.json';
import rawCancellations from '../../../../mock-data/cancellations.json';
import rawTdr from '../../../../mock-data/tdr.json';
import rawNotifications from '../../../../mock-data/notifications.json';
import rawGrievances from '../../../../mock-data/grievances.json';
import rawFines from '../../../../mock-data/fines.json';
import rawIncidents from '../../../../mock-data/incidents.json';
import rawCrowdReports from '../../../../mock-data/crowd-reports.json';
import rawCleanlinessReports from '../../../../mock-data/cleanliness-reports.json';
import rawAuditLogs from '../../../../mock-data/audit-logs.json';

// In-Memory mutable states (initialized from read-only mock JSONs)
let memoryUsers: User[] = JSON.parse(JSON.stringify(rawUsers));
let memoryPassengers: Passenger[] = JSON.parse(JSON.stringify(rawPassengers));
let memoryStaff: Staff[] = JSON.parse(JSON.stringify(rawStaff));
let memoryStations: Station[] = JSON.parse(JSON.stringify(rawStations));
let memoryTrains: Train[] = JSON.parse(JSON.stringify(rawTrains));
let memoryRoutes: RouteStop[] = JSON.parse(JSON.stringify(rawRoutes));
let memorySchedules: Schedule[] = JSON.parse(JSON.stringify(rawSchedules));
let memoryCoaches: Coach[] = JSON.parse(JSON.stringify(rawCoaches));
let memorySeats: Seat[] = JSON.parse(JSON.stringify(rawSeats));
let memoryAvailability = JSON.parse(JSON.stringify(rawAvailability));
let memoryBookings: Booking[] = JSON.parse(JSON.stringify(rawBookings));
let memoryBookingPassengers: BookingPassenger[] = JSON.parse(JSON.stringify(rawBookingPassengers));
let memoryPayments: Payment[] = JSON.parse(JSON.stringify(rawPayments));
let memoryCancellations: Cancellation[] = JSON.parse(JSON.stringify(rawCancellations));
let memoryTdr: TdrClaim[] = JSON.parse(JSON.stringify(rawTdr));
let memoryNotifications: Notification[] = JSON.parse(JSON.stringify(rawNotifications));
let memoryGrievances: Grievance[] = JSON.parse(JSON.stringify(rawGrievances));
let memoryFines: Fine[] = JSON.parse(JSON.stringify(rawFines));
let memoryIncidents: Incident[] = JSON.parse(JSON.stringify(rawIncidents));
let memoryCrowdReports: CrowdReport[] = JSON.parse(JSON.stringify(rawCrowdReports));
let memoryCleanlinessReports: CleanlinessReport[] = JSON.parse(JSON.stringify(rawCleanlinessReports));
let memoryAuditLogs: AuditLog[] = JSON.parse(JSON.stringify(rawAuditLogs));

// Mock seed for platforms (not in root mock-data)
let memoryPlatforms: Platform[] = [
  { platformId: 1, stationId: 1, platformNumber: 1, status: 'ACTIVE', facilities: ['Waiting Hall', 'Water Dispenser', 'Escalator', 'Wheelchair Ramp'] },
  { platformId: 2, stationId: 1, platformNumber: 2, status: 'ACTIVE', facilities: ['Waiting Hall', 'Wi-Fi', 'Book Stall'] },
  { platformId: 3, stationId: 1, platformNumber: 3, status: 'ACTIVE', facilities: ['Water Dispenser', 'Digital Coach Display'] },
  { platformId: 4, stationId: 1, platformNumber: 16, status: 'ACTIVE', facilities: ['Waiting Lounge', 'High-Speed Wi-Fi', 'Executive Restroom'] },
  { platformId: 5, stationId: 7, platformNumber: 1, status: 'ACTIVE', facilities: ['VIP Lounge', 'Escalator', 'Automated Ticket Vending'] },
  { platformId: 6, stationId: 7, platformNumber: 2, status: 'MAINTENANCE', facilities: ['Overhead Shelter Renovation'] },
  { platformId: 7, stationId: 8, platformNumber: 1, status: 'ACTIVE', facilities: ['Waiting Hall', 'Tea Stall'] },
  { platformId: 8, stationId: 9, platformNumber: 2, status: 'ACTIVE', facilities: ['Wheelchair Assistance', 'Water Dispenser'] },
];

// Mock seed for fares (not in root mock-data)
let memoryFares: FareRule[] = [
  { fareId: 1, classType: '1A', baseRatePerKm: 3.50, reservationCharge: 60, tatkalCharge: 500, gstPercentage: 5, insurancePremium: 0.45 },
  { fareId: 2, classType: '2A', baseRatePerKm: 2.10, reservationCharge: 50, tatkalCharge: 400, gstPercentage: 5, insurancePremium: 0.45 },
  { fareId: 3, classType: '3A', baseRatePerKm: 1.45, reservationCharge: 40, tatkalCharge: 300, gstPercentage: 5, insurancePremium: 0.45 },
  { fareId: 4, classType: 'CC', baseRatePerKm: 1.30, reservationCharge: 40, tatkalCharge: 200, gstPercentage: 5, insurancePremium: 0.45 },
  { fareId: 5, classType: 'EC', baseRatePerKm: 2.80, reservationCharge: 60, tatkalCharge: 450, gstPercentage: 5, insurancePremium: 0.45 },
  { fareId: 6, classType: 'SL', baseRatePerKm: 0.55, reservationCharge: 20, tatkalCharge: 100, gstPercentage: 0, insurancePremium: 0.45 },
  { fareId: 7, classType: '2S', baseRatePerKm: 0.28, reservationCharge: 15, tatkalCharge: 50, gstPercentage: 0, insurancePremium: 0.45 },
];

// Mock seed for quotas (not in root mock-data)
let memoryQuotas: QuotaRule[] = [
  { quotaRuleId: 1, quota: 'GENERAL', allocatedPercentage: 70, description: 'Standard public allocation across all coaches' },
  { quotaRuleId: 2, quota: 'TATKAL', allocatedPercentage: 15, description: 'Emergency 24-hr advance booking premium allocation' },
  { quotaRuleId: 3, quota: 'LADIES', allocatedPercentage: 5, description: 'Reserved solely for female passengers traveling alone or with children' },
  { quotaRuleId: 4, quota: 'SENIOR_CITIZEN', allocatedPercentage: 5, description: 'Dedicated lower berth preference for elderly passengers' },
  { quotaRuleId: 5, quota: 'DIVYAANG', allocatedPercentage: 5, description: 'Accessible berth quota with companion entitlement' },
];

export async function simulateLatency(ms: number = API_CONFIG.DEFAULT_MOCK_LATENCY_MS): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// In-Memory Data Store Accessors
export const mockStore = {
  getUsers: () => memoryUsers,
  setUsers: (users: User[]) => { memoryUsers = users; },

  getPassengers: () => memoryPassengers,
  setPassengers: (p: Passenger[]) => { memoryPassengers = p; },

  getStaff: () => memoryStaff,
  setStaff: (s: Staff[]) => { memoryStaff = s; },

  getStations: () => memoryStations,
  setStations: (s: Station[]) => { memoryStations = s; },

  getPlatforms: () => memoryPlatforms,
  setPlatforms: (p: Platform[]) => { memoryPlatforms = p; },

  getTrains: () => memoryTrains,
  setTrains: (t: Train[]) => { memoryTrains = t; },

  getRoutes: () => memoryRoutes,
  setRoutes: (r: RouteStop[]) => { memoryRoutes = r; },

  getSchedules: () => memorySchedules,
  setSchedules: (s: Schedule[]) => { memorySchedules = s; },

  getCoaches: () => memoryCoaches,
  setCoaches: (c: Coach[]) => { memoryCoaches = c; },

  getSeats: () => memorySeats,
  setSeats: (s: Seat[]) => { memorySeats = s; },

  getAvailability: () => memoryAvailability,
  setAvailability: (a: typeof memoryAvailability) => { memoryAvailability = a; },

  getFares: () => memoryFares,
  setFares: (f: FareRule[]) => { memoryFares = f; },

  getQuotas: () => memoryQuotas,
  setQuotas: (q: QuotaRule[]) => { memoryQuotas = q; },

  getBookings: () => memoryBookings,
  setBookings: (b: Booking[]) => { memoryBookings = b; },

  getBookingPassengers: () => memoryBookingPassengers,
  setBookingPassengers: (bp: BookingPassenger[]) => { memoryBookingPassengers = bp; },

  getPayments: () => memoryPayments,
  setPayments: (p: Payment[]) => { memoryPayments = p; },

  getCancellations: () => memoryCancellations,
  setCancellations: (c: Cancellation[]) => { memoryCancellations = c; },

  getTdr: () => memoryTdr,
  setTdr: (t: TdrClaim[]) => { memoryTdr = t; },

  getNotifications: () => memoryNotifications,
  setNotifications: (n: Notification[]) => { memoryNotifications = n; },

  getGrievances: () => memoryGrievances,
  setGrievances: (g: Grievance[]) => { memoryGrievances = g; },

  getFines: () => memoryFines,
  setFines: (f: Fine[]) => { memoryFines = f; },

  getIncidents: () => memoryIncidents,
  setIncidents: (i: Incident[]) => { memoryIncidents = i; },

  getCrowdReports: () => memoryCrowdReports,
  setCrowdReports: (cr: CrowdReport[]) => { memoryCrowdReports = cr; },

  getCleanlinessReports: () => memoryCleanlinessReports,
  setCleanlinessReports: (clr: CleanlinessReport[]) => { memoryCleanlinessReports = clr; },

  getAuditLogs: () => memoryAuditLogs,
  setAuditLogs: (al: AuditLog[]) => { memoryAuditLogs = al; },

  addAuditLog: (entry: Omit<AuditLog, 'auditId' | 'createdAt'>) => {
    const newLog: AuditLog = {
      auditId: memoryAuditLogs.length ? Math.max(...memoryAuditLogs.map((l) => l.auditId)) + 1 : 1,
      createdAt: new Date().toISOString(),
      ...entry,
    };
    memoryAuditLogs.unshift(newLog);
    return newLog;
  },
};
