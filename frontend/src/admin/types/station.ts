export interface Station {
  stationId: number;
  stationCode: string;
  stationName: string;
  city: string;
  state: string;
}

export interface Platform {
  platformId: number;
  stationId: number;
  platformNumber: number;
  status: 'ACTIVE' | 'MAINTENANCE' | 'CLOSED';
  facilities: string[];
}
