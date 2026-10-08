import { GrievanceCategory, GrievanceStatus } from '../constants/enums';

export interface Grievance {
  grievanceId: number;
  userId: number;
  category: GrievanceCategory;
  subject: string;
  description: string;
  status: GrievanceStatus;
  response: string | null;
  createdAt: string;
}
