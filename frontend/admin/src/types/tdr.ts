import { TdrStatus } from '../constants/enums';

export interface TdrClaim {
  tdrId: number;
  bookingId: number;
  pnr: string;
  reason: string;
  submittedAt: string;
  status: TdrStatus;
  refundAmount: number | null;
}
