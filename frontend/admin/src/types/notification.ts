export interface Notification {
  notificationId: number;
  userId: number;
  type: string;
  title: string;
  message: string;
  referenceId: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface BroadcastNotificationPayload {
  targetRole?: 'ALL' | 'PASSENGER' | 'STAFF' | 'ADMIN';
  type: string;
  title: string;
  message: string;
  referenceId?: string | null;
}
