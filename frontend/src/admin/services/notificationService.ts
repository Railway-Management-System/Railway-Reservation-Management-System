import { API_CONFIG } from '../config/api.config';
import { BroadcastNotificationPayload, Notification } from '../types/notification';
import { httpRequest } from './http.client';
import { mockStore, simulateLatency } from './mock.client';

export const notificationService = {
  async getNotifications(): Promise<Notification[]> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      // Admin notifications: all notifications or targeted to user 7
      const list = mockStore.getNotifications();
      return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }

    return httpRequest<Notification[]>('/api/notifications');
  },

  async markAsRead(notificationId: number): Promise<void> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency(100);
      const list = mockStore.getNotifications();
      const item = list.find((n) => n.notificationId === notificationId);
      if (item) {
        item.isRead = true;
        mockStore.setNotifications([...list]);
      }
      return;
    }

    return httpRequest<void>(`/api/notifications/${notificationId}/read`, {
      method: 'PUT',
    });
  },

  // CONTRACT-GAP: see ADMIN_CONTRACT_GAPS.md
  // Broadcast endpoint is not in current API contract. Simulated in-memory.
  async broadcastNotification(payload: BroadcastNotificationPayload): Promise<Notification> {
    if (API_CONFIG.USE_MOCK) {
      await simulateLatency();
      const list = mockStore.getNotifications();
      const newId = Math.max(...list.map((n) => n.notificationId), 0) + 1;
      const newNotif: Notification = {
        notificationId: newId,
        userId: 1, // sample broadcast recipient
        type: payload.type,
        title: payload.title,
        message: payload.message,
        referenceId: payload.referenceId || null,
        isRead: false,
        createdAt: new Date().toISOString(),
      };
      mockStore.setNotifications([newNotif, ...list]);

      mockStore.addAuditLog({
        userId: 7,
        action: 'CREATE',
        entityType: 'NOTIFICATION_BROADCAST',
        entityId: newId.toString(),
        oldValue: null,
        newValue: newNotif,
      });

      return newNotif;
    }

    throw new Error('CONTRACT GAP: Broadcast notification endpoint is not available in the live REST API yet.');
  },
};
