import { API_CONFIG } from '../admin/config/api.config';

export class StaffApiError extends Error {
  code: string;
  details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'StaffApiError';
    this.code = code;
    this.details = details;
  }
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface StaffLoginResponse {
  userId: number;
  staffId: number;
  employeeId: string;
  name: string;
  designation: string;
  role: 'STAFF';
  token: string;
}

export interface StaffAssignment {
  assignId: number;
  staffId: number;
  scheduleId: number | null;
  stationId: number | null;
  dutyType: 'TRAIN_DUTY' | 'STATION_DUTY' | 'COUNTER_DUTY' | 'MAINTENANCE_DUTY';
  shiftStart: string;
  shiftEnd: string;
  isActive: boolean;
  station: {
    stationId: number;
    stationCode: string;
    stationName: string;
  } | null;
  schedule: {
    scheduleId: number;
    trainId: number;
    trainNumber: string;
    trainName: string;
    journeyDate: string;
  } | null;
}

export interface ChartPassenger {
  snapshotId: number;
  scheduleId: number;
  pnr: string;
  passengerNo: number;
  passengerName: string;
  coachNo: string;
  seatNo: number;
  berthType: string;
  status: string;
  fromStationId: number;
  fromStationCode: string;
  toStationId: number;
  toStationCode: string;
  concessionFlag: boolean;
  generatedAt: string;
}

export interface PnrBookingDetails {
  pnr: string;
  bookingStatus: string;
  trainNumber: string;
  trainName: string;
  journeyDate: string;
  classType: string;
  quota: string;
  totalFare: number;
  passengerCount: number;
  createdAt: string;
  boardingStation: {
    stationCode: string;
    stationName: string;
  };
  destinationStation: {
    stationCode: string;
    stationName: string;
  };
  passengers: Array<{
    passengerNo: number;
    name: string;
    age: number;
    gender: string;
    status: string;
    queuePosition: string | null;
    coachNumber: string | null;
    seatNumber: number | null;
    berthType: string | null;
  }>;
}

export interface VerifyTicketPayload {
  pnr: string;
  passengerNo: number;
  idChecked: boolean;
  concessionChecked?: boolean;
  result: 'VALID' | 'INVALID' | 'MISMATCH';
  remarks?: string;
}

export interface IssueFinePayload {
  passengerName: string;
  idProofReference: string;
  trainId: number;
  amount: number;
  reason: 'TICKETLESS_TRAVEL' | 'UNAUTHORIZED_CLASS' | 'SMOKING_NUISANCE' | 'UNBOOKED_LUGGAGE';
  paymentStatus: 'PAID' | 'UNPAID';
}

export interface ReportIncidentPayload {
  scheduleId?: number | null;
  stationId?: number | null;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface LogDelayPayload {
  scheduleId: number;
  delayMinutes: number;
}

export interface ReportCrowdPayload {
  stationId: number;
  platformNo: number;
  crowdLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'OVERCROWDED';
  headCount?: number;
}

export interface ReportCleanlinessPayload {
  issueType: 'TOILET_DIRTY' | 'LITTER' | 'WATER_SHORTAGE' | 'LINEN_SOILED' | 'PESTS' | 'SPILLAGE';
  description: string;
  trainId?: number | null;
  coachId?: number | null;
  stationId?: number | null;
  platformNo?: number | null;
}

export interface CreateMaintenanceTaskPayload {
  coachId?: number | null;
  platformId?: number | null;
  type: string;
  description: string;
}

export interface CounterBookingPayload {
  trainId: number;
  journeyDate: string;
  boardingStationId: number;
  destinationStationId: number;
  classType: string;
  quota?: string;
  isWalkin?: boolean;
  registeredUserId?: number | null;
  passengers: Array<{
    name: string;
    age: number;
    gender: 'MALE' | 'FEMALE' | 'OTHER';
    idProofType?: string;
    idProofReference?: string;
    disabilityType?: string;
    concessionType?: string;
    berthPreference?: string;
  }>;
  payment?: {
    method?: string;
    amountCollected?: number;
  };
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(API_CONFIG.STORAGE_KEYS.STAFF_TOKEN) || localStorage.getItem(API_CONFIG.STORAGE_KEYS.TOKEN);
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const url = `${API_CONFIG.BASE_URL}${endpoint}`;
  const response = await fetch(url, { ...options, headers });
  const body = (await response.json().catch(() => ({}))) as ApiEnvelope<T>;

  if (!response.ok || !body.success) {
    const code = body?.error?.code || `HTTP_${response.status}`;
    const message = body?.error?.message || response.statusText || 'Request failed';
    throw new StaffApiError(code, message, body?.error?.details);
  }

  return body.data;
}

export const staffApiService = {
  // 1. Staff Authentication
  async login(employeeId: string, password: string): Promise<StaffLoginResponse> {
    const data = await request<StaffLoginResponse>('/api/auth/staff/login', {
      method: 'POST',
      body: JSON.stringify({ employeeId, password }),
    });
    localStorage.setItem(API_CONFIG.STORAGE_KEYS.STAFF_TOKEN, data.token);
    localStorage.setItem(API_CONFIG.STORAGE_KEYS.STAFF_USER, JSON.stringify(data));
    return data;
  },

  // 2. Current Duty Assignment
  async getCurrentAssignment(): Promise<StaffAssignment> {
    return request<StaffAssignment>('/api/staff/assignments/current');
  },

  // 3. Passenger Chart Manifest
  async getScheduleChart(scheduleId: number): Promise<ChartPassenger[]> {
    return request<ChartPassenger[]>(`/api/staff/schedules/${scheduleId}/chart`);
  },

  // 4. Ticket Scanner & PNR Verification
  async getBookingByPnr(pnr: string): Promise<PnrBookingDetails> {
    return request<PnrBookingDetails>(`/api/staff/pnr/${encodeURIComponent(pnr)}`);
  },

  async verifyTicket(payload: VerifyTicketPayload): Promise<{ verifyId: number; result: string }> {
    return request<{ verifyId: number; result: string }>('/api/staff/verification', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // 5. Boarding & No-Show Management
  async boardPassenger(pnr: string, passengerNo: number): Promise<{ pnr: string; passengerNo: number; status: string }> {
    return request<{ pnr: string; passengerNo: number; status: string }>('/api/staff/boarding', {
      method: 'POST',
      body: JSON.stringify({ pnr, passengerNo }),
    });
  },

  async markNoShow(pnr: string, passengerNo: number): Promise<{ pnr: string; passengerNo: number; status: string }> {
    return request<{ pnr: string; passengerNo: number; status: string }>('/api/staff/no-show', {
      method: 'POST',
      body: JSON.stringify({ pnr, passengerNo }),
    });
  },

  // 6. On-Spot Fines & Penalties
  async issueFine(payload: IssueFinePayload): Promise<any> {
    return request('/api/staff/fines', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // 7. Operations & Incident Dispatch
  async reportIncident(payload: ReportIncidentPayload): Promise<any> {
    return request('/api/staff/incidents', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async logDelay(payload: LogDelayPayload): Promise<{ scheduleId: number; delayMinutes: number; status: string }> {
    return request<{ scheduleId: number; delayMinutes: number; status: string }>('/api/staff/delays', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async reportCrowd(payload: ReportCrowdPayload): Promise<any> {
    return request('/api/staff/crowd-reports', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async reportCleanliness(payload: ReportCleanlinessPayload): Promise<any> {
    return request('/api/staff/cleanliness-reports', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // 8. Maintenance Tasks
  async createMaintenanceTask(payload: CreateMaintenanceTaskPayload): Promise<any> {
    return request('/api/maintenance/tasks', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateMaintenanceTaskStatus(maintId: number, status: string, completionRemarks?: string): Promise<any> {
    return request(`/api/maintenance/tasks/${maintId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, completionRemarks }),
    });
  },

  // 9. Station Counter Booking
  async createCounterBooking(payload: CounterBookingPayload): Promise<any> {
    return request('/api/counter/bookings', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
