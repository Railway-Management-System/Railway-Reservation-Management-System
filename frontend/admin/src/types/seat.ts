import { BerthType, SeatStatus } from '../constants/enums';

export interface Seat {
  seatId: number;
  coachId: number;
  seatNumber: number;
  berthType: BerthType;
  seatStatus: SeatStatus;
}

export interface SegmentSeatAllocation {
  coachNumber: string;
  seatNumber: number;
  trainId: number;
  journeyDate: string;
  startStopSequence: number;
  endStopSequence: number;
  passengerName?: string;
  pnr?: string;
}
