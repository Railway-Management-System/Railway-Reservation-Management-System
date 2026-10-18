import { ScheduleStatus } from '../constants/enums';

export interface Schedule {
  scheduleId: number;
  trainId: number;
  journeyDate: string;
  status: ScheduleStatus;
  delayMinutes: number;
}
