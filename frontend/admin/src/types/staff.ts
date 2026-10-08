import { StaffStatus } from '../constants/enums';

export interface Staff {
  staffId: number;
  userId: number;
  employeeId: string;
  name: string;
  designation: string;
  assignedStationId: number | null;
  status: StaffStatus;
}

export interface CreateStaffPayload {
  name: string;
  email: string;
  phone: string;
  employeeId: string;
  designation: string;
  assignedStationId?: number | null;
  status?: StaffStatus;
}

export interface UpdateStaffPayload {
  designation?: string;
  assignedStationId?: number | null;
  status?: StaffStatus;
}
