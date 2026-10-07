import { CrowdLevel } from '../constants/enums';

export interface CrowdReport {
  crowdReportId: number;
  stationId: number;
  platformNumber: number;
  crowdLevel: CrowdLevel;
  headCount: number | null;
  recordedBy: number;
  recordedAt: string;
}
