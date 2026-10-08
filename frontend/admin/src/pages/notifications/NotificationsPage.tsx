import React, { useEffect, useState } from 'react';
import { Check, Send } from 'lucide-react';
import { notificationService } from '../../services/notificationService';
import { Notification, BroadcastNotificationPayload } from '../../types/notification';
import { DataTable, Column } from '../../components/DataTable';
import { Modal } from '../../components/Modal';
import { PageHeader } from '../../components/PageHeader';
import { formatDateTime } from '../../utils/format';

export const NotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [readFilter, setReadFilter] = useState<'ALL' | 'UNREAD' | 'READ'>('ALL');

  // Broadcast Modal State
  const [broadcastModalOpen, setBroadcastModalOpen] = useState(false);
  const [broadcastPayload, setBroadcastPayload] = useState<BroadcastNotificationPayload>({
    targetRole: 'ALL',
    type: 'EMERGENCY',
    title: '',
    message: '',
    referenceId: '',
  });
  const [isSubmittingBroadcast, setIsSubmittingBroadcast] = useState(false);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const data = await notificationService.getNotifications();
      let filtered = data;
      if (readFilter === 'UNREAD') filtered = data.filter((n) => !n.isRead);
      else if (readFilter === 'READ') filtered = data.filter((n) => n.isRead);
      setNotifications(filtered);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [readFilter]);

  const handleMarkAsRead = async (id: number) => {
    try {
      await notificationService.markAsRead(id);
      await loadNotifications();
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const handleBroadcastSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingBroadcast(true);
    try {
      await notificationService.broadcastNotification(broadcastPayload);
      await loadNotifications();
      setBroadcastModalOpen(false);
      setBroadcastPayload({
        targetRole: 'ALL',
        type: 'EMERGENCY',
        title: '',
        message: '',
        referenceId: '',
      });
      alert('Broadcast notification dispatched to system recipients.');
    } catch (err: any) {
      alert(err.message || 'Failed to dispatch broadcast notification.');
    } finally {
      setIsSubmittingBroadcast(false);
    }
  };

  const columns: Column<Notification>[] = [
    {
      header: 'Alert Type',
      accessorKey: 'type',
      sortable: true,
      cell: (row) => (
        <span className="font-mono font-bold text-xs bg-slate-100 text-slate-800 px-2 py-0.5 rounded">
          {row.type}
        </span>
      ),
    },
    {
      header: 'Notification Heading',
      cell: (row) => (
        <div>
          <div className="font-bold text-slate-900 text-xs">{row.title}</div>
          <p className="text-[11px] text-slate-500 mt-0.5">{row.message}</p>
        </div>
      ),
    },
    {
      header: 'Reference',
      accessorKey: 'referenceId',
      cell: (row) => (
        <span className="font-mono text-xs text-slate-600">
          {row.referenceId || 'System Wide'}
        </span>
      ),
    },
    {
      header: 'Status',
      cell: (row) =>
        row.isRead ? (
          <span className="text-[11px] font-medium text-slate-400">Read</span>
        ) : (
          <span className="text-[11px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">
            Unread
          </span>
        ),
    },
    {
      header: 'Sent Timestamp',
      accessorKey: 'createdAt',
      sortable: true,
      cell: (row) => <span className="text-xs text-slate-500">{formatDateTime(row.createdAt)}</span>,
    },
    {
      header: 'Actions',
      align: 'right',
      cell: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          {!row.isRead && (
            <button
              onClick={() => handleMarkAsRead(row.notificationId)}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>Mark Read</span>
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Notifications & Broadcast Dispatcher"
        description="Review passenger alerts and compose administrative emergency or operational broadcasts."
        actions={
          <div className="flex items-center gap-3">
            <select
              value={readFilter}
              onChange={(e) => setReadFilter(e.target.value as any)}
              className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-700 focus:ring-2 focus:ring-orange-500 focus:outline-none"
            >
              <option value="ALL">All Alerts</option>
              <option value="UNREAD">Unread Only</option>
              <option value="READ">Read Only</option>
            </select>
            <button
              onClick={() => setBroadcastModalOpen(true)}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <Send className="w-4 h-4" />
              <span>Broadcast Alert</span>
            </button>
          </div>
        }
      />

      <DataTable
        data={notifications}
        columns={columns}
        loading={loading}
        searchPlaceholder="Search notifications by title, type, reference..."
        emptyMessage="No system alerts found."
      />

      {/* Broadcast Composer Modal */}
      <Modal
        isOpen={broadcastModalOpen}
        onClose={() => setBroadcastModalOpen(false)}
        title="Compose System Broadcast Alert"
        maxWidth="lg"
      >
        <form onSubmit={handleBroadcastSubmit} className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            Note: Broadcast notifications are currently serviced in-memory (Contract gap proposed: POST /api/admin/notifications/broadcast).
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                Target Audience *
              </label>
              <select
                value={broadcastPayload.targetRole}
                onChange={(e) =>
                  setBroadcastPayload({ ...broadcastPayload, targetRole: e.target.value as any })
                }
                className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-orange-500 focus:outline-none"
              >
                <option value="ALL">ALL (Passengers + Staff)</option>
                <option value="PASSENGER">PASSENGER accounts only</option>
                <option value="STAFF">STAFF / TC personnel only</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                Alert Type *
              </label>
              <select
                value={broadcastPayload.type}
                onChange={(e) =>
                  setBroadcastPayload({ ...broadcastPayload, type: e.target.value })
                }
                className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-orange-500 focus:outline-none"
              >
                <option value="EMERGENCY">EMERGENCY</option>
                <option value="DELAY">DELAY</option>
                <option value="PLATFORM_CHANGE">PLATFORM_CHANGE</option>
                <option value="STATUS_UPDATE">STATUS_UPDATE</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
              Title Heading *
            </label>
            <input
              type="text"
              required
              value={broadcastPayload.title}
              onChange={(e) =>
                setBroadcastPayload({ ...broadcastPayload, title: e.target.value })
              }
              className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-orange-500 focus:outline-none"
              placeholder="e.g. Critical Fog Advisory - Northern Railway"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
              Broadcast Message Body *
            </label>
            <textarea
              required
              rows={4}
              value={broadcastPayload.message}
              onChange={(e) =>
                setBroadcastPayload({ ...broadcastPayload, message: e.target.value })
              }
              className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-orange-500 focus:outline-none"
              placeholder="Provide full advisory instructions for affected passengers or crew..."
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setBroadcastModalOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingBroadcast}
              className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-lg shadow-xs disabled:opacity-50"
            >
              {isSubmittingBroadcast ? 'Dispatching...' : 'Dispatch Broadcast'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
