export type GrievanceCategory =
  | 'TRAIN_CLEANLINESS'
  | 'REFUND'
  | 'STAFF_BEHAVIOR'
  | 'FOOD_QUALITY'
  | 'PUNCTUALITY'
  | 'OTHER'
  | string;

export type GrievanceStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'REJECTED' | 'SUBMITTED' | string;

export interface Grievance {
  grievanceId: string | number;
  userId: number;
  category: GrievanceCategory;
  subject: string;
  description: string;
  status: GrievanceStatus;
  response: string | null;
  createdAt: string;
}

