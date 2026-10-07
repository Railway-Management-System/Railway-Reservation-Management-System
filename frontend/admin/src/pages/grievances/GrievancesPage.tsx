import React, { useEffect, useState } from 'react';
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

  const loadData = async () => {
    setLoading(true);
    try {
      const [gList, uList] = await Promise.all([
        grievanceService.getGrievances(),
        userService.getUsers(),
      ]);
      setGrievances(gList);
      setUsers(uList);
    } catch (err) {
      console.error('Failed to load grievances:', err);
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
    setStatusSelection(g.status === 'SUBMITTED' ? 'IN_PROGRESS' : g.status);
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
            <div className="text-[11px] text-slate-400 font-mono">{u?.email}</div>
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
          <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{row.description}</p>
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
        contractGapProposedEndpoint="GET /api/admin/grievances"
      />

      <DataTable
        data={grievances}
        columns={columns}
        loading={loading}
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
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                Resolution Remarks (Official Railway Authority Response) *
              </label>
              <textarea
                required
                rows={4}
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                placeholder="State specific remedial action taken (e.g. On-board housekeeping OBHS dispatched, refund processed via gateway...)"
                className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-orange-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                Updated Ticket Status *
              </label>
              <select
                value={statusSelection}
                onChange={(e) => setStatusSelection(e.target.value as GrievanceStatus)}
                className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-orange-500 focus:outline-none font-semibold"
              >
                <option value="IN_PROGRESS">IN_PROGRESS (Under investigation)</option>
                <option value="RESOLVED">RESOLVED (Remedy provided)</option>
                <option value="REJECTED">REJECTED (Invalid claim)</option>
              </select>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setActiveGrievance(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-lg shadow-xs disabled:opacity-50"
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
