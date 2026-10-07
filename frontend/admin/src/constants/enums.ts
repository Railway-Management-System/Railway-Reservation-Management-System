export const Role = {
  PASSENGER: 'PASSENGER',
  STAFF: 'STAFF',
  ADMIN: 'ADMIN',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const AccountStatus = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  PENDING: 'PENDING',
} as const;
export type AccountStatus = (typeof AccountStatus)[keyof typeof AccountStatus];

export const BookingStatus = {
  PAYMENT_PENDING: 'PAYMENT_PENDING',
  CONFIRMED: 'CONFIRMED',
  RAC: 'RAC',
  WAITING_LIST: 'WAITING_LIST',
  CANCELLED: 'CANCELLED',
  FAILED: 'FAILED',
} as const;
export type BookingStatus = (typeof BookingStatus)[keyof typeof BookingStatus];

export const PassengerStatus = {
  CONFIRMED: 'CONFIRMED',
  RAC: 'RAC',
  WAITING_LIST: 'WAITING_LIST',
  CANCELLED: 'CANCELLED',
  BOARDED: 'BOARDED',
  NO_SHOW: 'NO_SHOW',
} as const;
export type PassengerStatus = (typeof PassengerStatus)[keyof typeof PassengerStatus];

export const PaymentStatus = {
  PENDING: 'PENDING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const PaymentMode = {
  CREDIT_CARD: 'CREDIT_CARD',
  DEBIT_CARD: 'DEBIT_CARD',
  UPI: 'UPI',
  NET_BANKING: 'NET_BANKING',
} as const;
export type PaymentMode = (typeof PaymentMode)[keyof typeof PaymentMode];

export const Quota = {
  GENERAL: 'GENERAL',
  LADIES: 'LADIES',
  TATKAL: 'TATKAL',
  SENIOR_CITIZEN: 'SENIOR_CITIZEN',
  DIVYAANG: 'DIVYAANG',
} as const;
export type Quota = (typeof Quota)[keyof typeof Quota];

export const ClassType = {
  '1A': '1A',
  '2A': '2A',
  '3A': '3A',
  SL: 'SL',
  CC: 'CC',
  '2S': '2S',
  EC: 'EC',
} as const;
export type ClassType = (typeof ClassType)[keyof typeof ClassType];

export const BerthType = {
  LOWER: 'LOWER',
  MIDDLE: 'MIDDLE',
  UPPER: 'UPPER',
  SIDE_LOWER: 'SIDE_LOWER',
  SIDE_UPPER: 'SIDE_UPPER',
  WINDOW: 'WINDOW',
  AISLE: 'AISLE',
  NO_BERTH: 'NO_BERTH',
} as const;
export type BerthType = (typeof BerthType)[keyof typeof BerthType];

export const SeatStatus = {
  AVAILABLE: 'AVAILABLE',
  BOOKED: 'BOOKED',
  RESERVED: 'RESERVED',
  BLOCKED: 'BLOCKED',
} as const;
export type SeatStatus = (typeof SeatStatus)[keyof typeof SeatStatus];

export const TrainType = {
  RAJDHANI: 'RAJDHANI',
  SHATABDI: 'SHATABDI',
  VANDE_BHARAT: 'VANDE_BHARAT',
  EXPRESS: 'EXPRESS',
} as const;
export type TrainType = (typeof TrainType)[keyof typeof TrainType];

export const TrainStatus = {
  ACTIVE: 'ACTIVE',
  CANCELLED: 'CANCELLED',
  RESCHEDULED: 'RESCHEDULED',
  DIVERTED: 'DIVERTED',
} as const;
export type TrainStatus = (typeof TrainStatus)[keyof typeof TrainStatus];

export const ScheduleStatus = {
  ON_TIME: 'ON_TIME',
  DELAYED: 'DELAYED',
  CANCELLED: 'CANCELLED',
  RESCHEDULED: 'RESCHEDULED',
} as const;
export type ScheduleStatus = (typeof ScheduleStatus)[keyof typeof ScheduleStatus];

export const StaffStatus = {
  ON_DUTY: 'ON_DUTY',
  OFF_DUTY: 'OFF_DUTY',
  ON_LEAVE: 'ON_LEAVE',
} as const;
export type StaffStatus = (typeof StaffStatus)[keyof typeof StaffStatus];

export const IdProofType = {
  AADHAAR: 'AADHAAR',
  PAN: 'PAN',
  PASSPORT: 'PASSPORT',
  VOTER_ID: 'VOTER_ID',
  DRIVING_LICENSE: 'DRIVING_LICENSE',
  STUDENT_ID: 'STUDENT_ID',
  GOVT_ID: 'GOVT_ID',
} as const;
export type IdProofType = (typeof IdProofType)[keyof typeof IdProofType];

export const ConcessionType = {
  NONE: 'NONE',
  SENIOR_CITIZEN: 'SENIOR_CITIZEN',
  STUDENT: 'STUDENT',
  DIVYAANG: 'DIVYAANG',
  MEDICAL: 'MEDICAL',
} as const;
export type ConcessionType = (typeof ConcessionType)[keyof typeof ConcessionType];

export const DisabilityType = {
  NONE: 'NONE',
  ORTHOPEDIC: 'ORTHOPEDIC',
  VISUAL: 'VISUAL',
  HEARING: 'HEARING',
  MENTAL: 'MENTAL',
} as const;
export type DisabilityType = (typeof DisabilityType)[keyof typeof DisabilityType];

export const TdrStatus = {
  FILED: 'FILED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  REFUND_PROCESSED: 'REFUND_PROCESSED',
} as const;
export type TdrStatus = (typeof TdrStatus)[keyof typeof TdrStatus];

export const GrievanceCategory = {
  TICKETING: 'TICKETING',
  TRAIN_CLEANLINESS: 'TRAIN_CLEANLINESS',
  STATION_CLEANLINESS: 'STATION_CLEANLINESS',
  STAFF_BEHAVIOUR: 'STAFF_BEHAVIOUR',
  SECURITY: 'SECURITY',
  REFUND: 'REFUND',
  OTHER: 'OTHER',
} as const;
export type GrievanceCategory = (typeof GrievanceCategory)[keyof typeof GrievanceCategory];

export const GrievanceStatus = {
  SUBMITTED: 'SUBMITTED',
  IN_PROGRESS: 'IN_PROGRESS',
  RESOLVED: 'RESOLVED',
  REJECTED: 'REJECTED',
} as const;
export type GrievanceStatus = (typeof GrievanceStatus)[keyof typeof GrievanceStatus];

export const FinePaymentStatus = {
  PAID: 'PAID',
  UNPAID: 'UNPAID',
} as const;
export type FinePaymentStatus = (typeof FinePaymentStatus)[keyof typeof FinePaymentStatus];

export const IncidentSeverity = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
} as const;
export type IncidentSeverity = (typeof IncidentSeverity)[keyof typeof IncidentSeverity];

export const IncidentType = {
  MEDICAL_EMERGENCY: 'MEDICAL_EMERGENCY',
  SECURITY: 'SECURITY',
  TECHNICAL_FAILURE: 'TECHNICAL_FAILURE',
  ACCIDENT: 'ACCIDENT',
} as const;
export type IncidentType = (typeof IncidentType)[keyof typeof IncidentType];

export const IncidentStatus = {
  REPORTED: 'REPORTED',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  RESOLVED: 'RESOLVED',
} as const;
export type IncidentStatus = (typeof IncidentStatus)[keyof typeof IncidentStatus];

export const CrowdLevel = {
  LOW: 'LOW',
  MODERATE: 'MODERATE',
  HIGH: 'HIGH',
  OVERCROWDED: 'OVERCROWDED',
} as const;
export type CrowdLevel = (typeof CrowdLevel)[keyof typeof CrowdLevel];

export const CleanlinessIssueType = {
  TOILET_DIRTY: 'TOILET_DIRTY',
  LITTER: 'LITTER',
  WATER_SHORTAGE: 'WATER_SHORTAGE',
  LINEN_SOILED: 'LINEN_SOILED',
  PESTS: 'PESTS',
  SPILLAGE: 'SPILLAGE',
} as const;
export type CleanlinessIssueType = (typeof CleanlinessIssueType)[keyof typeof CleanlinessIssueType];

export const CleanlinessStatus = {
  REPORTED: 'REPORTED',
  ATTENDING: 'ATTENDING',
  RESOLVED: 'RESOLVED',
} as const;
export type CleanlinessStatus = (typeof CleanlinessStatus)[keyof typeof CleanlinessStatus];

export const AuditAction = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  OVERRIDE: 'OVERRIDE',
  SUSPEND_USER: 'SUSPEND_USER',
  ACTIVATE_USER: 'ACTIVATE_USER',
  APPROVE_TDR: 'APPROVE_TDR',
  REJECT_TDR: 'REJECT_TDR',
  UPDATE_SCHEDULE_DELAY: 'UPDATE_SCHEDULE_DELAY',
} as const;
export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

// --- User-Friendly Display Labels Helpers ---

export function getBookingStatusLabel(status: BookingStatus): string {
  switch (status) {
    case BookingStatus.PAYMENT_PENDING: return 'Payment Pending';
    case BookingStatus.CONFIRMED: return 'Confirmed';
    case BookingStatus.RAC: return 'RAC';
    case BookingStatus.WAITING_LIST: return 'Waiting List';
    case BookingStatus.CANCELLED: return 'Cancelled';
    case BookingStatus.FAILED: return 'Failed';
    default: return status;
  }
}

export function getPassengerStatusLabel(status: PassengerStatus): string {
  switch (status) {
    case PassengerStatus.CONFIRMED: return 'Confirmed';
    case PassengerStatus.RAC: return 'RAC';
    case PassengerStatus.WAITING_LIST: return 'Waiting List';
    case PassengerStatus.CANCELLED: return 'Cancelled';
    case PassengerStatus.BOARDED: return 'Boarded';
    case PassengerStatus.NO_SHOW: return 'No Show';
    default: return status;
  }
}

export function getClassTypeLabel(cls: ClassType): string {
  switch (cls) {
    case '1A': return '1A - First AC';
    case '2A': return '2A - AC 2 Tier';
    case '3A': return '3A - AC 3 Tier';
    case 'SL': return 'SL - Sleeper';
    case 'CC': return 'CC - AC Chair Car';
    case '2S': return '2S - Second Sitting';
    case 'EC': return 'EC - Exec Chair Car';
    default: return cls;
  }
}

export function getBerthTypeLabel(berth: BerthType | null): string {
  if (!berth) return 'Unallocated';
  switch (berth) {
    case 'LOWER': return 'Lower';
    case 'MIDDLE': return 'Middle';
    case 'UPPER': return 'Upper';
    case 'SIDE_LOWER': return 'Side Lower';
    case 'SIDE_UPPER': return 'Side Upper';
    case 'WINDOW': return 'Window';
    case 'AISLE': return 'Aisle';
    case 'NO_BERTH': return 'No Berth';
    default: return berth;
  }
}

export function getQuotaLabel(quota: Quota): string {
  switch (quota) {
    case 'GENERAL': return 'General';
    case 'LADIES': return 'Ladies';
    case 'TATKAL': return 'Tatkal';
    case 'SENIOR_CITIZEN': return 'Senior Citizen';
    case 'DIVYAANG': return 'Divyaang (Specially Abled)';
    default: return quota;
  }
}

export function getAccountStatusLabel(status: AccountStatus): string {
  switch (status) {
    case 'ACTIVE': return 'Active';
    case 'SUSPENDED': return 'Suspended';
    case 'PENDING': return 'Pending';
    default: return status;
  }
}

export function getScheduleStatusLabel(status: ScheduleStatus): string {
  switch (status) {
    case 'ON_TIME': return 'On Time';
    case 'DELAYED': return 'Delayed';
    case 'CANCELLED': return 'Cancelled';
    case 'RESCHEDULED': return 'Rescheduled';
    default: return status;
  }
}

export function getTdrStatusLabel(status: TdrStatus): string {
  switch (status) {
    case 'FILED': return 'Filed';
    case 'UNDER_REVIEW': return 'Under Review';
    case 'APPROVED': return 'Approved';
    case 'REJECTED': return 'Rejected';
    case 'REFUND_PROCESSED': return 'Refund Processed';
    default: return status;
  }
}

export function getGrievanceStatusLabel(status: GrievanceStatus): string {
  switch (status) {
    case 'SUBMITTED': return 'Submitted';
    case 'IN_PROGRESS': return 'In Progress';
    case 'RESOLVED': return 'Resolved';
    case 'REJECTED': return 'Rejected';
    default: return status;
  }
}
