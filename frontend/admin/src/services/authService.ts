import { API_CONFIG } from '../config/api.config';
import { AdminAuthUser } from '../types/user';
import { httpRequest } from './http.client';
import { mockStore, simulateLatency } from './mock.client';

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

    const data = await httpRequest<AdminAuthUser>('/api/auth/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (data.role !== 'ADMIN') {
      throw new Error('Unauthorized: Admin access required.');
    }

    localStorage.setItem(API_CONFIG.STORAGE_KEYS.TOKEN, data.token);
    localStorage.setItem(API_CONFIG.STORAGE_KEYS.USER, JSON.stringify(data));
    return data;
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
};
