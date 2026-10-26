import { isServiceMock } from '../config/api.config';
import { Fine } from '../types/fine';
import { httpRequest } from './http.client';
import { mockStore, simulateLatency } from './mock.client';

export const fineService = {
  async getFines(): Promise<Fine[]> {
    if (isServiceMock('fines')) {
      await simulateLatency();
      return [...mockStore.getFines()].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
    }
    return httpRequest<Fine[]>('/api/admin/fines');
  },
};

