import { ClassType } from '../constants/enums';

export interface Coach {
  coachId: number;
  trainId: number;
  coachNumber: string;
  coachType: string;
  classType: ClassType;
}
