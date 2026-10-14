export interface Cancellation {
  cancellationId: number;
  bookingId: number;
  passengerId: number | null;
  cancellationDate: string;
  cancellationCharge: number;
  refundAmount: number;
  status: 'PROCESSED' | 'PENDING';
}
