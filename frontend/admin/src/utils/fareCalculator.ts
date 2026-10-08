import { ClassType } from '../constants/enums';
import { FareCalculationInput, FareCalculationBreakdown, FareRule } from '../types/fare';

export const DEFAULT_FARE_RULES: Record<ClassType, FareRule> = {
  '1A': {
    fareId: 1,
    classType: '1A',
    baseRatePerKm: 3.50,
    reservationCharge: 60,
    tatkalCharge: 500,
    gstPercentage: 5,
    insurancePremium: 0.45,
  },
  '2A': {
    fareId: 2,
    classType: '2A',
    baseRatePerKm: 2.10,
    reservationCharge: 50,
    tatkalCharge: 400,
    gstPercentage: 5,
    insurancePremium: 0.45,
  },
  '3A': {
    fareId: 3,
    classType: '3A',
    baseRatePerKm: 1.45,
    reservationCharge: 40,
    tatkalCharge: 300,
    gstPercentage: 5,
    insurancePremium: 0.45,
  },
  'CC': {
    fareId: 4,
    classType: 'CC',
    baseRatePerKm: 1.30,
    reservationCharge: 40,
    tatkalCharge: 200,
    gstPercentage: 5,
    insurancePremium: 0.45,
  },
  'EC': {
    fareId: 5,
    classType: 'EC',
    baseRatePerKm: 2.80,
    reservationCharge: 60,
    tatkalCharge: 450,
    gstPercentage: 5,
    insurancePremium: 0.45,
  },
  'SL': {
    fareId: 6,
    classType: 'SL',
    baseRatePerKm: 0.55,
    reservationCharge: 20,
    tatkalCharge: 100,
    gstPercentage: 0,
    insurancePremium: 0.45,
  },
  '2S': {
    fareId: 7,
    classType: '2S',
    baseRatePerKm: 0.28,
    reservationCharge: 15,
    tatkalCharge: 50,
    gstPercentage: 0,
    insurancePremium: 0.45,
  },
};

export const AC_CLASSES: Set<ClassType> = new Set(['1A', '2A', '3A', 'CC', 'EC']);

/**
 * Calculates fare according to the canonical formula:
 * Base Fare = Route Distance (km) * Class Base Rate
 * Subtotal = Base Fare + Reservation Charge + Tatkal Charge (if quota = TATKAL) + Insurance Premium (if selected)
 * Total Fare = Subtotal + GST (5% for AC classes) - Concession Discount (if applied)
 */
export function calculateFare(
  input: FareCalculationInput,
  customRule?: Partial<FareRule>
): FareCalculationBreakdown {
  const defaultRule = DEFAULT_FARE_RULES[input.classType] || DEFAULT_FARE_RULES['SL'];
  const rule = { ...defaultRule, ...customRule };

  const distance = Math.max(0, input.distanceKm);
  const baseFare = Number((distance * rule.baseRatePerKm).toFixed(2));
  const reservationCharge = Number(rule.reservationCharge.toFixed(2));
  const tatkalCharge = input.isTatkal ? Number(rule.tatkalCharge.toFixed(2)) : 0;
  const insurancePremium = input.insuranceSelected ? Number(rule.insurancePremium.toFixed(2)) : 0;

  const subtotal = Number(
    (baseFare + reservationCharge + tatkalCharge + insurancePremium).toFixed(2)
  );

  const isAcClass = AC_CLASSES.has(input.classType);
  const gstRate = isAcClass ? (rule.gstPercentage || 5) / 100 : 0;
  const gst = Number((subtotal * gstRate).toFixed(2));

  const concessionDiscount = input.concessionDiscount
    ? Number(Math.min(subtotal + gst, input.concessionDiscount).toFixed(2))
    : 0;

  const totalFare = Number((subtotal + gst - concessionDiscount).toFixed(2));

  return {
    baseFare,
    reservationCharge,
    tatkalCharge,
    insurancePremium,
    gst,
    concessionDiscount,
    subtotal,
    totalFare,
  };
}
