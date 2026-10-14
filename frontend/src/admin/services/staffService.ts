import { API_CONFIG } from '../config/api.config';
import { CreateStaffPayload, Staff, UpdateStaffPayload } from '../types/staff';
import { User } from '../types/user';
import { httpRequest } from './http.client';
import { mockStore, simulateLatency } from './mock.client';

export const staffService = {
  async getStaff(): Promise<Staff[]> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      return mockStore.getStaff();
    }
    return httpRequest<Staff[]>('/api/admin/staff');
  },

  async createStaff(payload: CreateStaffPayload): Promise<Staff> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      const users = mockStore.getUsers();
      const staffList = mockStore.getStaff();

      const newUserId = Math.max(...users.map((u) => u.userId), 0) + 1;
      const newStaffId = Math.max(...staffList.map((s) => s.staffId), 0) + 1;

      const newUser: User = {
        userId: newUserId,
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
        role: 'STAFF',
        accountStatus: 'ACTIVE',
        createdAt: new Date().toISOString(),
      };
      mockStore.setUsers([...users, newUser]);

      const newStaff: Staff = {
        staffId: newStaffId,
        userId: newUserId,
        employeeId: payload.employeeId,
        name: payload.name,
        designation: payload.designation,
        assignedStationId: payload.assignedStationId ?? null,
        status: payload.status || 'ON_DUTY',
      };
      mockStore.setStaff([...staffList, newStaff]);

      mockStore.addAuditLog({
        userId: 7,
        action: 'CREATE',
        entityType: 'STAFF',
        entityId: newStaffId.toString(),
        oldValue: null,
        newValue: { ...newStaff },
      });

      return newStaff;
    }

    return httpRequest<Staff>('/api/admin/staff', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateStaff(staffId: number, payload: UpdateStaffPayload): Promise<Staff> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      const staffList = mockStore.getStaff();
      const idx = staffList.findIndex((s) => s.staffId === staffId);
      if (idx === -1) {
        throw new Error(`Staff with ID ${staffId} not found.`);
      }

      const prev = { ...staffList[idx] };
      const updated: Staff = {
        ...prev,
        designation: payload.designation ?? prev.designation,
        assignedStationId: payload.assignedStationId !== undefined ? payload.assignedStationId : prev.assignedStationId,
        status: payload.status ?? prev.status,
      };

      staffList[idx] = updated;
      mockStore.setStaff([...staffList]);

      mockStore.addAuditLog({
        userId: 7,
        action: 'UPDATE',
        entityType: 'STAFF',
        entityId: staffId.toString(),
        oldValue: { ...prev },
        newValue: { ...updated },
      });

      return updated;
    }

    return httpRequest<Staff>(`/api/admin/staff/${staffId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },
};
