import { FinePaymentStatus } from '../constants/enums';

export interface Fine {
  fineId: number;
  staffId: number;
  passengerName: string;
  idProofReference: string | null;
  trainId: number | null;
  amount: number;
  reason: string;
  paymentStatus: FinePaymentStatus;
  issuedAt: string;
}
