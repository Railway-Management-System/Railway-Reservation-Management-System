import { CleanlinessIssueType, CleanlinessStatus } from '../constants/enums';

export interface CleanlinessReport {
  reportId: number;
  reportedBy: number;
  trainId: number | null;
  coachId: number | null;
  stationId: number | null;
  platformNumber: number | null;
  issueType: CleanlinessIssueType;
  description: string;
  status: CleanlinessStatus;
  createdAt: string;
}
