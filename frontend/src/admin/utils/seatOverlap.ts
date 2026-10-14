/**
 * Pure utility function to verify Segmented Seat Allocation integrity
 * Reference: docs/DATA_RELATIONSHIPS.md §3 and DEVELOPMENT_RULES.md §6.4
 *
 * Formula:
 * Two passenger segments A and B on the same train, coach, seat, and journey date
 * overlap (conflict) if and only if:
 *    max(startA, startB) < min(endA, endB)
 * where start and end are the 1-indexed stopSequence values along the route.
 *
 * Note: If passenger A travels [1, 2] and passenger B travels [2, 3],
 * max(1, 2) = 2, min(2, 3) = 2.
 * 2 < 2 is FALSE => NO CONFLICT! Passenger A alights at station 2 and passenger B boards at station 2.
 */

export function hasSegmentOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number
): boolean {
  if (startA >= endA || startB >= endB) {
    throw new Error('Invalid segment: start sequence must be strictly less than end sequence.');
  }
  return Math.max(startA, startB) < Math.min(endA, endB);
}

export interface SegmentSpan {
  startStopSequence: number;
  endStopSequence: number;
}

export function isSeatAvailableForSegment(
  existingAllocations: SegmentSpan[],
  requestedStart: number,
  requestedEnd: number
): boolean {
  for (const allocation of existingAllocations) {
    if (
      hasSegmentOverlap(
        allocation.startStopSequence,
        allocation.endStopSequence,
        requestedStart,
        requestedEnd
      )
    ) {
      return false; // Conflict found
    }
  }
  return true; // No conflict found
}
