import { API_CONFIG } from '../config/api.config';
import { AdminAuthUser } from '../types/user';
import { httpRequest } from './http.client';
import { mockStore, simulateLatency } from './mock.client';
import { staffApiService } from '../../services/staffApiService';

export const authService = {
  async adminLogin(email: string, password: string): Promise<AdminAuthUser> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      // Look for user with role ADMIN in mock data
      const admin = mockStore.getUsers().find(
        (u) => u.role === 'ADMIN' && u.email.toLowerCase() === email.toLowerCase()
      );

      if (!admin || password !== 'AdminPassword123!') {
        // Also allow generic successful mock login for testing ease if email includes "admin"
        if (email.toLowerCase().includes('admin') && password.length >= 6) {
          const authUser: AdminAuthUser = {
            userId: admin ? admin.userId : 7,
            name: admin ? admin.name : 'Rajesh Gupta',
            role: 'ADMIN',
            token: 'mock-token-admin-1',
          };
          localStorage.setItem(API_CONFIG.STORAGE_KEYS.TOKEN, authUser.token);
          localStorage.setItem(API_CONFIG.STORAGE_KEYS.USER, JSON.stringify(authUser));
          return authUser;
        }
        throw new Error('Invalid administrator credentials.');
      }

      if (admin.accountStatus === 'SUSPENDED') {
        throw new Error('This administrator account has been suspended.');
      }

      const authUser: AdminAuthUser = {
        userId: admin.userId,
        name: admin.name,
        role: 'ADMIN',
        token: 'mock-token-admin-1',
      };

      localStorage.setItem(API_CONFIG.STORAGE_KEYS.TOKEN, authUser.token);
      localStorage.setItem(API_CONFIG.STORAGE_KEYS.USER, JSON.stringify(authUser));
      return authUser;
    }

    try {
      const data = await httpRequest<{
        userId: number;
        adminId?: number;
        name: string;
        role: string;
        accessLevel?: string;
        token: string;
      }>('/api/auth/admin/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      if (data.role !== 'ADMIN') {
        throw new Error('Unauthorized: Admin access required.');
      }

      const authUser: AdminAuthUser = {
        userId: data.userId,
        name: data.name,
        role: 'ADMIN',
        token: data.token,
      };

      localStorage.setItem(API_CONFIG.STORAGE_KEYS.TOKEN, authUser.token);
      localStorage.setItem(API_CONFIG.STORAGE_KEYS.USER, JSON.stringify(authUser));
      return authUser;
    } catch (err: any) {
      if (err.status === 401) {
        throw new Error('Invalid email or password.');
      } else if (err.status === 403) {
        throw new Error(err.message || 'Access forbidden.');
      } else if (err.code === 'NETWORK_ERROR' || err.message?.includes('Cannot reach the server')) {
        throw new Error('Cannot reach the server. Please check that the backend is running.');
      }
      throw err;
    }
  },


  getCurrentUser(): AdminAuthUser | null {
    const raw = localStorage.getItem(API_CONFIG.STORAGE_KEYS.USER);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AdminAuthUser;
    } catch {
      return null;
    }
  },

  logout(): void {
    localStorage.removeItem(API_CONFIG.STORAGE_KEYS.TOKEN);
    localStorage.removeItem(API_CONFIG.STORAGE_KEYS.USER);
  },

  // ─── Staff Auth ───────────────────────────────────────────────────────────
  async staffLogin(employeeId: string, password: string): Promise<{ name: string; employeeId: string; staffId?: number; role?: string; token?: string }> {
    try {
      const res = await staffApiService.login(employeeId, password);
      if (res && res.token) {
        const staffUser = {
          name: res.name || 'Railway Staff',
          employeeId: res.employeeId || employeeId,
          staffId: res.staffId,
          role: res.role || 'STAFF',
          designation: res.designation,
          userId: res.userId,
          token: res.token
        };
        localStorage.setItem(API_CONFIG.STORAGE_KEYS.STAFF_TOKEN, res.token);
        localStorage.setItem(API_CONFIG.STORAGE_KEYS.STAFF_USER, JSON.stringify(staffUser));
        return staffUser;
      }
    } catch (apiErr: any) {
      if (!API_CONFIG.USE_MOCK) {
        throw apiErr;
      }
      // If mock mode is explicitly true, allow mock fallback
      console.warn('Real staff login failed, checking mock credentials:', apiErr.message);
    }

    await simulateLatency();
    // Valid staff credentials (mock)
    const STAFF_CREDENTIALS = [
      { employeeId: 'staff@railways.gov.in', password: 'StaffPassword123!', name: 'Vikram Singh', staffId: 1 },
      { employeeId: 'EMP-TC-101', password: 'StaffPassword123!', name: 'Vikram Singh', staffId: 1 },
      { employeeId: 'EMP-SM-205', password: 'StaffPassword123!', name: 'Sunita Rao', staffId: 2 },
      { employeeId: 'EMP-TC-108', password: 'StaffPassword123!', name: 'Ramesh Nair', staffId: 3 },
    ];
    const match = STAFF_CREDENTIALS.find(
      (c) => c.employeeId.toLowerCase() === employeeId.toLowerCase() && c.password === password
    );
    if (!match) {
      throw new Error('Invalid staff credentials. Please check your Employee ID and password.');
    }
    const staffUser = { name: match.name, employeeId: match.employeeId, staffId: match.staffId, role: 'STAFF' };
    localStorage.setItem(API_CONFIG.STORAGE_KEYS.STAFF_TOKEN, 'mock-token-staff-1');
    localStorage.setItem(API_CONFIG.STORAGE_KEYS.STAFF_USER, JSON.stringify(staffUser));
    return staffUser;
  },

  getStaffUser(): { name: string; employeeId: string } | null {
    const raw = localStorage.getItem(API_CONFIG.STORAGE_KEYS.STAFF_USER);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  },

  isStaffAuthenticated(): boolean {
    return !!localStorage.getItem(API_CONFIG.STORAGE_KEYS.STAFF_TOKEN);
  },

  staffLogout(): void {
    localStorage.removeItem(API_CONFIG.STORAGE_KEYS.STAFF_TOKEN);
    localStorage.removeItem(API_CONFIG.STORAGE_KEYS.STAFF_USER);
  },
};
