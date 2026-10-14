import { ClassType } from '../constants/enums';

export interface FareRule {
  fareId: number;
  classType: ClassType;
  baseRatePerKm: number;
  reservationCharge: number;
  tatkalCharge: number;
  gstPercentage: number;
  insurancePremium: number;
}

export interface FareCalculationInput {
  distanceKm: number;
  classType: ClassType;
  isTatkal?: boolean;
  insuranceSelected?: boolean;
  concessionDiscount?: number;
}

export interface FareCalculationBreakdown {
  baseFare: number;
  reservationCharge: number;
  tatkalCharge: number;
  insurancePremium: number;
  gst: number;
  concessionDiscount: number;
  subtotal: number;
  totalFare: number;
}
