import { describe, it, expect } from 'vitest';
import { hasSegmentOverlap, isSeatAvailableForSegment } from './seatOverlap';

describe('Segmented Seat Integrity: hasSegmentOverlap', () => {
  it('allows non-overlapping adjacent segments [1, 2] and [2, 4]', () => {
    // Alighting and boarding at the same station (stop sequence 2)
    const overlap = hasSegmentOverlap(1, 2, 2, 4);
    expect(overlap).toBe(false);
  });

  it('allows disjoint segments [1, 2] and [3, 4]', () => {
    const overlap = hasSegmentOverlap(1, 2, 3, 4);
    expect(overlap).toBe(false);
  });

  it('detects overlapping segments [1, 3] and [2, 4]', () => {
    // Segment [1, 3] overlaps with [2, 4] between stations 2 and 3
    const overlap = hasSegmentOverlap(1, 3, 2, 4);
    expect(overlap).toBe(true);
  });

  it('detects fully contained segments [1, 4] and [2, 3]', () => {
    const overlap = hasSegmentOverlap(1, 4, 2, 3);
    expect(overlap).toBe(true);
  });

  it('detects identical segments [1, 3] and [1, 3]', () => {
    const overlap = hasSegmentOverlap(1, 3, 1, 3);
    expect(overlap).toBe(true);
  });

  it('throws an error if start is greater than or equal to end', () => {
    expect(() => hasSegmentOverlap(3, 2, 1, 4)).toThrow();
    expect(() => hasSegmentOverlap(2, 2, 1, 4)).toThrow();
  });
});

describe('Seat Availability for Segments: isSeatAvailableForSegment', () => {
  const existingAllocations = [
    { startStopSequence: 1, endStopSequence: 2 }, // Leg 1
    { startStopSequence: 4, endStopSequence: 6 }, // Leg 3
  ];

  it('allows booking segment [2, 4] in between existing allocations', () => {
    const available = isSeatAvailableForSegment(existingAllocations, 2, 4);
    expect(available).toBe(true);
  });

  it('rejects booking segment [1, 3] due to conflict with [1, 2]', () => {
    const available = isSeatAvailableForSegment(existingAllocations, 1, 3);
    expect(available).toBe(false);
  });

  it('rejects booking segment [3, 5] due to conflict with [4, 6]', () => {
    const available = isSeatAvailableForSegment(existingAllocations, 3, 5);
    expect(available).toBe(false);
  });
});
