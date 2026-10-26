import { isServiceMock } from '../config/api.config';
import { CreateStaffPayload, Staff, UpdateStaffPayload } from '../types/staff';
import { User } from '../types/user';
import { httpRequest } from './http.client';
import { mockStore, simulateLatency } from './mock.client';

export const staffService = {
  async getStaff(): Promise<Staff[]> {
    if (isServiceMock('staff')) {
      await simulateLatency();
      return mockStore.getStaff();
    }
    const data = await httpRequest<any[]>('/api/admin/staff');
    return data.map((item) => ({
      ...item,
      employeeId: item.employeeNo || item.employeeId,
      employeeNo: item.employeeNo || item.employeeId,
    }));
  },

  async createStaff(payload: CreateStaffPayload): Promise<Staff> {
    const employeeNo = payload.employeeNo || payload.employeeId || `EMP-${Date.now().toString().slice(-4)}`;
    const password = payload.password || 'StaffPassword123!';

    if (isServiceMock('staff')) {
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
        employeeId: employeeNo,
        employeeNo,
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

    const data = await httpRequest<any>('/api/admin/staff', {
      method: 'POST',
      body: JSON.stringify({
        employeeNo,
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
        designation: payload.designation,
        password,
      }),
    });

    return {
      ...data,
      employeeId: data.employeeNo || data.employeeId,
    };
  },

  async updateStaff(staffId: number, payload: UpdateStaffPayload): Promise<Staff> {
    if (isServiceMock('staff')) {
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

    // Backend route is PUT /api/admin/staff/:staffId/status with body: { status }
    const status = payload.status === 'ON_LEAVE' ? 'ON_LEAVE' : (payload.status === 'OFF_DUTY' ? 'SUSPENDED' : 'ACTIVE');
    const data = await httpRequest<any>(`/api/admin/staff/${staffId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });

    return {
      staffId,
      userId: data.userId || 0,
      employeeId: data.employeeNo,
      employeeNo: data.employeeNo,
      name: data.name || '',
      designation: data.designation || '',
      status: data.status,
    };
  },
};

