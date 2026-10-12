export type StaffStatus = 'ON_DUTY' | 'OFF_DUTY';
export type BoardingStatus = 'NOT_VERIFIED' | 'BOARDED' | 'NO_SHOW';
export type VerificationStatus = 'UNCHECKED' | 'VALID' | 'INVALID' | 'MISMATCH';

export interface Staff {
  staffId: number;
  userId: number;
  employeeId: string;
  name: string;
  designation: string;
  assignedStationId: number;
  assignedTrainId: number | null;
  assignedCoaches: string[];
  shift: string;
  status: StaffStatus;
}

export interface Station {
  stationId: number;
  stationCode: string;
  stationName: string;
  city: string;
  state: string;
}

export interface Train {
  trainId: number;
  trainNumber: string;
  trainName: string;
  trainType: string;
  sourceStationId: number;
  destinationStationId: number;
  runningDays: string[];
  status: string;
}

export interface RouteStop {
  routeId: number;
  trainId: number;
  stationId: number;
  stopSequence: number;
  arrivalTime: string;
  departureTime: string;
  distanceFromOrigin: number;
  platformNumber: number;
}

export interface Schedule {
  scheduleId: number;
  trainId: number;
  journeyDate: string;
  status: 'ON_TIME' | 'DELAYED' | 'RESCHEDULED' | 'CANCELLED';
  delayMinutes: number;
  currentStation?: string;
  nextStation?: string;
  platformNumber?: number;
}

export interface ManifestPassenger {
  manifestId: number;
  bookingId: number;
  pnr: string;
  trainId: number;
  journeyDate: string;
  boardingStationId: number;
  destinationStationId: number;
  passengerId: number;
  name: string;
  age: number;
  gender: string;
  idProofType: string;
  idProofReference: string;
  coachNumber: string | null;
  seatNumber: number | null;
  berthType: string | null;
  classType: string;
  quota: string;
  bookingStatus: 'CONFIRMED' | 'RAC' | 'WAITING_LIST' | 'CANCELLED';
  racRank?: number;
  wlRank?: number;
  boardingStatus: BoardingStatus;
  verificationStatus: VerificationStatus;
  verificationNotes?: string;
  verifiedAt?: string | null;
}

export interface Vacancy {
  vacancyId: number;
  trainId: number;
  coachNumber: string;
  seatNumber: number;
  berthType: string;
  reason: string;
  availableFromStationId: number;
  availableToStationId: number;
}

export interface Fine {
  fineId: number;
  staffId: number;
  passengerName: string;
  idProofReference: string;
  trainId: number;
  amount: number;
  reason: string;
  paymentStatus: 'PAID' | 'UNPAID';
  issuedAt: string;
  receiptNumber: string;
}

export interface Incident {
  incidentId: number;
  reportedBy: number;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  locationType: 'TRAIN' | 'STATION';
  stationId: number | null;
  trainId: number | null;
  description: string;
  status: 'RESOLVED' | 'ACKNOWLEDGED';
  createdAt: string;
}

export interface CrowdReport {
  crowdReportId: number;
  stationId: number;
  platformNumber: number;
  crowdLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'OVERCROWDED';
  headCount: number;
  recordedBy: number;
  recordedAt: string;
}

export interface CleanlinessReport {
  reportId: number;
  reportedBy: number;
  trainId: number | null;
  coachId: number | null;
  stationId: number | null;
  platformNumber: number | null;
  issueType: string;
  description: string;
  status: 'RESOLVED' | 'ATTENDING' | 'PENDING';
  createdAt: string;
}
