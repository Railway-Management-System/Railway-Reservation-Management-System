import { PaymentMode, PaymentStatus } from '../constants/enums';

export interface Payment {
  paymentId: number;
  bookingId: number;
  amount: number;
  paymentMode: PaymentMode;
  paymentStatus: PaymentStatus;
  gatewayTransactionId: string;
  paidAt: string | null;
}
