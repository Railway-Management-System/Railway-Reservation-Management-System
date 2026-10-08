import React, { useEffect, useState } from 'react';
import { UserCheck, UserX, Shield, Mail, Phone, Calendar, Eye } from 'lucide-react';
import { userService } from '../../services/userService';
import { User } from '../../types/user';
import { AccountStatus } from '../../constants/enums';
import { DataTable, Column } from '../../components/DataTable';
import { StatusBadge } from '../../components/StatusBadge';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Modal } from '../../components/Modal';
import { PageHeader } from '../../components/PageHeader';
import { formatDateTime } from '../../utils/format';

export const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Drawer / Details Modal State
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Suspend/Activate Confirm Dialog State
  const [statusActionUser, setStatusActionUser] = useState<User | null>(null);
  const [statusActionTarget, setStatusActionTarget] = useState<AccountStatus>('SUSPENDED');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await userService.getUsers(
        undefined,
        statusFilter !== 'ALL' ? (statusFilter as AccountStatus) : undefined
      );
      setUsers(data);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [statusFilter]);

  const handleConfirmStatusChange = async (reason?: string) => {
    if (!statusActionUser) return;
    setIsUpdatingStatus(true);
    try {
      await userService.updateUserStatus(statusActionUser.userId, statusActionTarget, reason);
      await loadUsers();
      setStatusActionUser(null);
    } catch (err) {
      console.error('Failed to update user status:', err);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const columns: Column<User>[] = [
    {
      header: 'User ID',
      accessorKey: 'userId',
      sortable: true,
      cell: (row) => <span className="font-mono font-bold text-slate-900">#{row.userId}</span>,
    },
    {
      header: 'Passenger Name',
      accessorKey: 'name',
      sortable: true,
      cell: (row) => (
        <div>
          <div className="font-semibold text-slate-900">{row.name}</div>
          <div className="text-xs text-slate-500 font-mono">{row.email}</div>
        </div>
      ),
    },
    {
      header: 'Contact Phone',
      accessorKey: 'phone',
      cell: (row) => <span className="font-mono text-slate-600">{row.phone}</span>,
    },
    {
      header: 'Account Status',
      accessorKey: 'accountStatus',
      sortable: true,
      cell: (row) => <StatusBadge status={row.accountStatus} />,
    },
    {
      header: 'Registered Since',
      accessorKey: 'createdAt',
      sortable: true,
      cell: (row) => <span className="text-xs text-slate-500">{formatDateTime(row.createdAt)}</span>,
    },
    {
      header: 'Actions',
      align: 'right',
      cell: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => setSelectedUser(row)}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>
          {row.accountStatus === 'ACTIVE' ? (
            <button
              onClick={() => {
                setStatusActionUser(row);
                setStatusActionTarget('SUSPENDED');
              }}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 transition-colors flex items-center gap-1"
            >
              <UserX className="w-3.5 h-3.5" />
              <span>Suspend</span>
            </button>
          ) : (
            <button
              onClick={() => {
                setStatusActionUser(row);
                setStatusActionTarget('ACTIVE');
              }}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors flex items-center gap-1"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Activate</span>
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Passenger User Accounts"
        description="Search registered public passengers, inspect account profiles, and enforce suspension protocols."
        actions={
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="ALL">All Account Statuses</option>
              <option value="ACTIVE">Active Only</option>
              <option value="SUSPENDED">Suspended Only</option>
              <option value="PENDING">Pending Verification</option>
            </select>
          </div>
        }
      />

      <DataTable
        data={users}
        columns={columns}
        loading={loading}
        searchPlaceholder="Search passenger by name, email, phone, or ID..."
        emptyMessage="No passenger accounts found matching criteria."
      />

      {/* User Details Drawer Modal */}
      <Modal
        isOpen={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        title="Passenger Account Overview"
        maxWidth="md"
      >
        {selectedUser && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h4 className="text-lg font-bold text-slate-900">{selectedUser.name}</h4>
                <p className="text-xs text-slate-500 font-mono">User ID: #{selectedUser.userId}</p>
              </div>
              <StatusBadge status={selectedUser.accountStatus} size="md" />
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                <Mail className="w-4 h-4 text-slate-400" />
                <span className="font-mono text-slate-700">{selectedUser.email}</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                <Phone className="w-4 h-4 text-slate-400" />
                <span className="font-mono text-slate-700">{selectedUser.phone}</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span className="text-slate-700">
                  Joined: {formatDateTime(selectedUser.createdAt)}
                </span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                <Shield className="w-4 h-4 text-slate-400" />
                <span className="text-slate-700 font-mono">Role: {selectedUser.role}</span>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirmation Dialog for Suspension / Activation */}
      <ConfirmDialog
        isOpen={!!statusActionUser}
        title={statusActionTarget === 'SUSPENDED' ? 'Suspend Passenger Account' : 'Reactivate Passenger Account'}
        message={
          statusActionTarget === 'SUSPENDED'
            ? `Are you sure you want to suspend account #${statusActionUser?.userId} (${statusActionUser?.name})? Suspended users cannot initiate new bookings.`
            : `Are you sure you want to reactivate account #${statusActionUser?.userId} (${statusActionUser?.name})?`
        }
        confirmLabel={statusActionTarget === 'SUSPENDED' ? 'Suspend Account' : 'Reactivate'}
        isDestructive={statusActionTarget === 'SUSPENDED'}
        requireReason={statusActionTarget === 'SUSPENDED'}
        reasonPlaceholder="e.g. Repeated bot booking activity, unauthorized script patterns..."
        isLoading={isUpdatingStatus}
        onConfirm={handleConfirmStatusChange}
        onCancel={() => setStatusActionUser(null)}
      />
    </div>
  );
};
