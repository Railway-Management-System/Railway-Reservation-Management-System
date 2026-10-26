import { StaffStatus } from '../constants/enums';

export interface Staff {
  staffId: number;
  userId: number;
  employeeNo?: string;
  employeeId?: string;
  name: string;
  email?: string;
  phone?: string;
  designation: string;
  assignedStationId?: number | null;
  status: StaffStatus;
}

export interface CreateStaffPayload {
  name: string;
  email: string;
  phone: string;
  employeeNo?: string;
  employeeId?: string;
  designation: string;
  password?: string;
  assignedStationId?: number | null;
  status?: StaffStatus;
}

export interface UpdateStaffPayload {
  designation?: string;
  assignedStationId?: number | null;
  status?: StaffStatus;
}

