import { Role, AccountStatus } from '../constants/enums';

export interface User {
  userId: number;
  name: string;
  email: string;
  phone: string;
  role: Role;
  accountStatus: AccountStatus;
  createdAt: string;
}

export interface AdminAuthUser {
  userId: number;
  name: string;
  role: 'ADMIN';
  token: string;
}
