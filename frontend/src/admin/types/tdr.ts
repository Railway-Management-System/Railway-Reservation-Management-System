import { TdrStatus } from '../constants/enums';

export interface TdrClaim {
  tdrRefNo: string;
  tdrId?: number;
  bookingId?: number;
  passengerNo?: number;
  pnr: string;
  reason: string;
  filedAt?: string;
  submittedAt?: string;
  evidenceRef?: string | null;
  status: TdrStatus;
  refundAmount: number | null;
  remarks?: string | null;
  reviewedBy?: number | null;
  reviewedAt?: string | null;
}

