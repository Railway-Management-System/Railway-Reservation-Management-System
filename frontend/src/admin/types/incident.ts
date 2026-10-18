import { IncidentType, IncidentSeverity, IncidentStatus } from '../constants/enums';

export interface Incident {
  incidentId: number;
  reportedBy: number;
  type: IncidentType;
  severity: IncidentSeverity;
  locationType: 'TRAIN' | 'STATION';
  stationId: number | null;
  trainId: number | null;
  description: string;
  status: IncidentStatus;
  createdAt: string;
}
