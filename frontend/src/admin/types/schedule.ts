import { ScheduleStatus } from '../constants/enums';

export interface ScheduleClassInventory {
  classId?: number;
  class_id?: number;
  classCode?: string;
  class_code?: string;
  className?: string;
  class_name?: string;
  availableSeats?: number;
  available_seats?: number;
  totalSeats?: number;
  total_seats?: number;
  racCount?: number;
  rac_count?: number;
  racCapacity?: number;
  rac_capacity?: number;
  wlCount?: number;
  wl_count?: number;
  wlCapacity?: number;
  wl_capacity?: number;
}

export interface Schedule {
  scheduleId: number;
  schedule_id?: number;
  trainId?: number;
  train_id?: number;
  trainNumber?: string;
  train_number?: string;
  trainName?: string;
  train_name?: string;
  journeyDate: string;
  journey_date?: string;
  departureTime?: string;
  departure_time?: string;
  arrivalTime?: string;
  arrival_time?: string;
  chartPreparedAt?: string | null;
  chart_prepared_at?: string | null;
  status: ScheduleStatus;
  delayMinutes: number;
  classes?: ScheduleClassInventory[];
  totalAvailableSeats?: number;
  total_available_seats?: number;
  totalRacCount?: number;
  total_rac_count?: number;
  totalWlCount?: number;
  total_wl_count?: number;
}

export interface ScheduleFilters {
  from_date?: string;
  fromDate?: string;
  to_date?: string;
  toDate?: string;
  train_no?: string;
  trainNo?: string;
  trainNumber?: string;
  limit?: number;
}
