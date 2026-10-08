import { BookingStatus, PassengerStatus, ClassType, Quota, BerthType } from '../constants/enums';
import { Payment } from './payment';
import { Cancellation } from './cancellation';
import { TdrClaim } from './tdr';

export interface Booking {
  bookingId: number;
  pnr: string;
  userId: number;
  trainId: number;
  journeyDate: string;
  boardingStationId: number;
  destinationStationId: number;
  classType: ClassType;
  quota: Quota;
  bookingStatus: BookingStatus;
  totalFare: number;
  createdAt: string;
}

export interface BookingPassenger {
  bookingPassengerId: number;
  bookingId: number;
  passengerId: number;
  name?: string;
  coachNumber: string | null;
  seatNumber: number | null;
  berthType: BerthType | null;
  passengerStatus: PassengerStatus;
}

export interface BookingDetail extends Booking {
  userName?: string;
  userEmail?: string;
  userPhone?: string;
  trainNumber?: string;
  trainName?: string;
  boardingStationCode?: string;
  destinationStationCode?: string;
  passengers: BookingPassenger[];
  payment?: Payment | null;
  cancellation?: Cancellation | null;
  tdr?: TdrClaim | null;
}
