import { API_CONFIG } from '../config/api.config';
import { AccountStatus } from '../constants/enums';
import { User } from '../types/user';
import { httpRequest } from './http.client';
import { mockStore, simulateLatency } from './mock.client';

export const userService = {
  async getUsers(search?: string, status?: AccountStatus): Promise<User[]> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      let list = mockStore.getUsers().filter((u) => u.role === 'PASSENGER');
      if (search && search.trim()) {
        const query = search.toLowerCase();
        list = list.filter(
          (u) =>
            u.name.toLowerCase().includes(query) ||
            u.email.toLowerCase().includes(query) ||
            u.phone.includes(query) ||
            u.userId.toString() === query
        );
      }
      if (status) {
        list = list.filter((u) => u.accountStatus === status);
      }
      return list;
    }

    const queryParams = new URLSearchParams();
    if (search) queryParams.append('search', search);
    if (status) queryParams.append('status', status);
    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';

    return httpRequest<User[]>(`/api/admin/users${queryString}`);
  },

  async updateUserStatus(
    userId: number,
    accountStatus: AccountStatus,
    reason?: string
  ): Promise<User> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      const users = mockStore.getUsers();
      const userIndex = users.findIndex((u) => u.userId === userId);
      if (userIndex === -1) {
        throw new Error(`User with ID ${userId} not found.`);
      }

      const prev = { ...users[userIndex] };
      users[userIndex] = {
        ...users[userIndex],
        accountStatus,
      };
      mockStore.setUsers([...users]);

      mockStore.addAuditLog({
        userId: 7,
        action: accountStatus === 'SUSPENDED' ? 'SUSPEND_USER' : 'ACTIVATE_USER',
        entityType: 'USER',
        entityId: userId.toString(),
        oldValue: { accountStatus: prev.accountStatus },
        newValue: { accountStatus, reason: reason || 'Admin status update' },
      });

      return users[userIndex];
    }

    return httpRequest<User>(`/api/admin/users/${userId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ accountStatus, reason }),
    });
  },
};
