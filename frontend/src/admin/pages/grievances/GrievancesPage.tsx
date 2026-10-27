import React, { useEffect, useState } from 'react';
import { API_CONFIG } from '../../config/api.config';
import { grievanceService } from '../../services/grievanceService';
import { userService } from '../../services/userService';
import { Grievance } from '../../types/grievance';
import { User } from '../../types/user';
import { GrievanceStatus } from '../../constants/enums';
import { DataTable, Column } from '../../components/DataTable';
import { StatusBadge } from '../../components/StatusBadge';
import { Modal } from '../../components/Modal';
import { PageHeader } from '../../components/PageHeader';
import { formatDateTime } from '../../utils/format';

export const GrievancesPage: React.FC = () => {
  const [grievances, setGrievances] = useState<Grievance[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Response Modal State
  const [activeGrievance, setActiveGrievance] = useState<Grievance | null>(null);
  const [responseText, setResponseText] = useState('');
  const [statusSelection, setStatusSelection] = useState<GrievanceStatus>('RESOLVED');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const gList = await grievanceService.getGrievances();
      setGrievances(gList);
      if (API_CONFIG.USE_MOCK) {
        const uList = await userService.getUsers();
        setUsers(uList);
      }
    } catch (err: any) {
      console.error('Failed to load grievances:', err);
      setError(err?.message || 'Failed to load grievance tickets.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const userMap = new Map(users.map((u) => [u.userId, u]));


  const handleOpenResponseModal = (g: Grievance) => {
    setActiveGrievance(g);
    setResponseText(g.response || '');
    setStatusSelection(g.status === 'SUBMITTED' ? 'IN_PROGRESS' : (g.status as GrievanceStatus));
  };


  const handleResponseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGrievance) return;
    setIsSubmitting(true);
    try {
      await grievanceService.respondToGrievance(
        activeGrievance.grievanceId,
        responseText,
        statusSelection
      );
      await loadData();
      setActiveGrievance(null);
    } catch (err: any) {
      alert(err.message || 'Failed to submit grievance response.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: Column<Grievance>[] = [
    {
      header: 'Ticket ID',
      accessorKey: 'grievanceId',
      sortable: true,
      cell: (row) => <span className="font-mono font-bold text-slate-900">#{row.grievanceId}</span>,
    },
    {
      header: 'Passenger Author',
      cell: (row) => {
        const u = userMap.get(row.userId);
        return (
          <div>
            <div className="font-semibold text-slate-900 text-xs">{u?.name || `User #${row.userId}`}</div>
            <div className="text-meta font-mono">{u?.email}</div>
          </div>
        );
      },
    },
    {
      header: 'Category',
      accessorKey: 'category',
      sortable: true,
      cell: (row) => (
        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
          {row.category.replace(/_/g, ' ')}
        </span>
      ),
    },
    {
      header: 'Complaint Subject & Notes',
      cell: (row) => (
        <div>
          <div className="font-bold text-slate-800 text-xs">{row.subject}</div>
          <p className="text-meta line-clamp-1 mt-0.5">{row.description}</p>
        </div>
      ),
    },
    {
      header: 'Redressal Status',
      accessorKey: 'status',
      sortable: true,
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      header: 'Filed Timestamp',
      accessorKey: 'createdAt',
      sortable: true,
      cell: (row) => <span className="text-xs text-slate-500">{formatDateTime(row.createdAt)}</span>,
    },
    {
      header: 'Actions',
      align: 'right',
      cell: (row) => (
        <button
          onClick={() => handleOpenResponseModal(row)}
          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-orange-600 hover:bg-orange-700 text-white transition-colors"
        >
          {row.response ? 'Update Remarks' : 'Respond'}
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Passenger Grievances & Redressal"
        description="Review passenger complaint tickets, coordinate with on-ground supervisors, and issue official railway resolution remarks."
      />

      <DataTable
        data={grievances}
        columns={columns}
        loading={loading}
        error={error}
        onRetry={loadData}
        searchPlaceholder="Search complaints by subject, category, author..."
        emptyMessage="No grievance tickets found."
      />

      {/* Grievance Response Modal */}
      <Modal
        isOpen={!!activeGrievance}
        onClose={() => setActiveGrievance(null)}
        title={`Respond to Grievance Ticket #${activeGrievance?.grievanceId}`}
        maxWidth="lg"
      >
        {activeGrievance && (
          <form onSubmit={handleResponseSubmit} className="space-y-4">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 text-sm">{activeGrievance.subject}</span>
                <StatusBadge status={activeGrievance.status} />
              </div>
              <p className="text-slate-600 text-xs leading-relaxed">{activeGrievance.description}</p>
              <div className="text-slate-400 font-mono text-[11px] pt-1 border-t border-slate-200">
                Category: {activeGrievance.category} · Filed: {formatDateTime(activeGrievance.createdAt)}
              </div>
            </div>

            <div>
              <label className="form-label">
                Resolution Remarks (Official Railway Authority Response) *
              </label>
              <textarea
                required
                rows={4}
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                placeholder="State specific remedial action taken (e.g. On-board housekeeping OBHS dispatched, refund processed via gateway...)"
                className="form-input"
              />
            </div>

            <div>
              <label className="form-label">
                Updated Ticket Status *
              </label>
              <select
                value={statusSelection}
                onChange={(e) => setStatusSelection(e.target.value as GrievanceStatus)}
                className="form-input"
              >
                <option value="IN_PROGRESS">IN_PROGRESS (Under investigation)</option>
                <option value="RESOLVED">RESOLVED (Remedy provided)</option>
                <option value="REJECTED">REJECTED (Invalid claim)</option>
              </select>
            </div>

            <div className="form-section-divider flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setActiveGrievance(null)}
                className="btn-ghost"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-secondary"
              >
                {isSubmitting ? 'Submitting...' : 'Dispatch Resolution'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
