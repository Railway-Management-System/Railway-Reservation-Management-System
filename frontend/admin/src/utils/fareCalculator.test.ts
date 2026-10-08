import { describe, it, expect } from 'vitest';
import { calculateFare } from './fareCalculator';

describe('Canonical Fare Formula: calculateFare', () => {
  it('calculates standard non-AC Sleeper fare with zero GST', () => {
    // 500 km in SL (rate 0.55/km, res 20)
    // Base = 500 * 0.55 = 275.00
    // Subtotal = 275 + 20 = 295.00
    // GST = 0% -> 0.00
    // Total = 295.00
    const breakdown = calculateFare({
      distanceKm: 500,
      classType: 'SL',
    });

    expect(breakdown.baseFare).toBe(275.0);
    expect(breakdown.reservationCharge).toBe(20.0);
    expect(breakdown.tatkalCharge).toBe(0);
    expect(breakdown.gst).toBe(0);
    expect(breakdown.subtotal).toBe(295.0);
    expect(breakdown.totalFare).toBe(295.0);
  });

  it('calculates 3A AC fare with 5% GST', () => {
    // 1000 km in 3A (rate 1.45/km, res 40)
    // Base = 1450.00
    // Subtotal = 1450 + 40 = 1490.00
    // GST = 5% of 1490 = 74.50
    // Total = 1490 + 74.50 = 1564.50
    const breakdown = calculateFare({
      distanceKm: 1000,
      classType: '3A',
    });

    expect(breakdown.baseFare).toBe(1450.0);
    expect(breakdown.reservationCharge).toBe(40.0);
    expect(breakdown.gst).toBe(74.5);
    expect(breakdown.totalFare).toBe(1564.5);
  });

  it('applies Tatkal charge, insurance, and concession discount properly', () => {
    // 1000 km in 3A, Tatkal (+300), Insurance (+0.45), Concession (-100)
    // Base = 1450.00
    // Subtotal = 1450 + 40 + 300 + 0.45 = 1790.45
    // GST = 5% of 1790.45 = 89.52
    // Subtotal + GST = 1879.97
    // Total = 1879.97 - 100 = 1779.97
    const breakdown = calculateFare({
      distanceKm: 1000,
      classType: '3A',
      isTatkal: true,
      insuranceSelected: true,
      concessionDiscount: 100,
    });

    expect(breakdown.tatkalCharge).toBe(300);
    expect(breakdown.insurancePremium).toBe(0.45);
    expect(breakdown.gst).toBe(89.52);
    expect(breakdown.concessionDiscount).toBe(100);
    expect(breakdown.totalFare).toBe(1779.97);
  });
});
