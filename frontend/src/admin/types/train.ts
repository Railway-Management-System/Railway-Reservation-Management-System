import { TrainType, TrainStatus } from '../constants/enums';

export interface Train {
  trainId: number;
  trainNumber: string;
  trainName: string;
  trainType: TrainType;
  sourceStationId: number;
  destinationStationId: number;
  runningDays: string[];
  status: TrainStatus;
}

export interface TrainRouteStop {
  routeId: number;
  stationId: number;
  stationCode: string;
  stationName: string;
  stopSequence: number;
  arrivalTime: string;
  departureTime: string;
  distanceFromOrigin: number;
  platformNumber: number;
}

export interface TrainDetail extends Train {
  route: TrainRouteStop[];
}
