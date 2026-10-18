export interface RouteStop {
  routeId: number;
  trainId: number;
  stationId: number;
  stopSequence: number;
  arrivalTime: string;
  departureTime: string;
  distanceFromOrigin: number;
  platformNumber: number;
}
