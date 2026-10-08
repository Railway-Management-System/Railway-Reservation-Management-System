import React, { useEffect, useState } from 'react';
import { tdrService } from '../../services/tdrService';
import { TdrClaim } from '../../types/tdr';
import { TdrStatus } from '../../constants/enums';
import { DataTable, Column } from '../../components/DataTable';
import { StatusBadge } from '../../components/StatusBadge';
import { Modal } from '../../components/Modal';
import { PageHeader } from '../../components/PageHeader';
import { formatCurrency, formatDateTime } from '../../utils/format';

export const TdrPage: React.FC = () => {
  const [claims, setClaims] = useState<TdrClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Adjudicate Modal State
  const [adjudicatingClaim, setAdjudicatingClaim] = useState<TdrClaim | null>(null);
  const [decision, setDecision] = useState<TdrStatus>('APPROVED');
  const [refundAmountInput, setRefundAmountInput] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await tdrService.getTdrClaims(
        statusFilter !== 'ALL' ? (statusFilter as TdrStatus) : undefined
      );
      setClaims(data);
    } catch (err) {
      console.error('Failed to load TDR claims:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const handleOpenAdjudicate = (claim: TdrClaim) => {
    setAdjudicatingClaim(claim);
    setDecision('APPROVED');
    setRefundAmountInput(claim.refundAmount || 1850);
  };

  const handleAdjudicateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjudicatingClaim) return;
    setIsSubmitting(true);
    try {
      await tdrService.adjudicateTdr(
        adjudicatingClaim.tdrId,
        decision,
        decision === 'APPROVED' ? Number(refundAmountInput) : null
      );
      await loadData();
      setAdjudicatingClaim(null);
    } catch (err: any) {
      alert(err.message || 'Failed to adjudicate TDR claim.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: Column<TdrClaim>[] = [
    {
      header: 'TDR ID',
      accessorKey: 'tdrId',
      sortable: true,
      cell: (row) => <span className="font-mono font-bold text-slate-900">#{row.tdrId}</span>,
    },
    {
      header: 'PNR Code',
      accessorKey: 'pnr',
      sortable: true,
      cell: (row) => (
        <span className="font-mono font-bold text-orange-800 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded text-xs">
          {row.pnr}
        </span>
      ),
    },
    {
      header: 'Dispute Justification',
      accessorKey: 'reason',
      sortable: true,
      cell: (row) => (
        <div>
          <span className="font-semibold text-slate-900 text-xs">{row.reason}</span>
          <div className="text-[11px] text-slate-400 font-mono">Booking #{row.bookingId}</div>
        </div>
      ),
    },
    {
      header: 'Submitted At',
      accessorKey: 'submittedAt',
      sortable: true,
      cell: (row) => <span className="text-xs text-slate-500">{formatDateTime(row.submittedAt)}</span>,
    },
    {
      header: 'Adjudication Status',
      accessorKey: 'status',
      sortable: true,
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      header: 'Refund Amount',
      cell: (row) => (
        <span className="font-mono font-bold text-slate-900 text-xs">
          {row.refundAmount ? formatCurrency(row.refundAmount) : '—'}
        </span>
      ),
    },
    {
      header: 'Actions',
      align: 'right',
      cell: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          {row.status === 'FILED' || row.status === 'UNDER_REVIEW' ? (
            <button
              onClick={() => handleOpenAdjudicate(row)}
              className="px-3 py-1 text-xs font-semibold rounded-lg bg-orange-600 hover:bg-orange-700 text-white transition-colors"
            >
              Adjudicate
            </button>
          ) : (
            <button
              onClick={() => handleOpenAdjudicate(row)}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
            >
              Review
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="TDR (Ticket Deposit Receipt) Adjudication"
        description="Review passenger refund disputes filed due to train delays, coach AC failures, or operational disruptions."
        actions={
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-700 focus:ring-2 focus:ring-orange-500 focus:outline-none"
          >
            <option value="ALL">All Claim Statuses</option>
            <option value="FILED">FILED Only</option>
            <option value="UNDER_REVIEW">UNDER_REVIEW Only</option>
            <option value="APPROVED">APPROVED Only</option>
            <option value="REJECTED">REJECTED Only</option>
          </select>
        }
      />

      <DataTable
        data={claims}
        columns={columns}
        loading={loading}
        searchPlaceholder="Search claims by PNR, reason..."
        emptyMessage="No TDR claims found."
      />

      {/* Adjudication Modal */}
      <Modal
        isOpen={!!adjudicatingClaim}
        onClose={() => setAdjudicatingClaim(null)}
        title={`Adjudicate TDR Claim #${adjudicatingClaim?.tdrId}`}
        maxWidth="md"
      >
        {adjudicatingClaim && (
          <form onSubmit={handleAdjudicateSubmit} className="space-y-4">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
              <div>
                PNR: <span className="font-mono font-bold text-slate-900">{adjudicatingClaim.pnr}</span>
              </div>
              <div>Reason: <span className="font-semibold text-slate-800">{adjudicatingClaim.reason}</span></div>
              <div className="text-slate-400">Submitted: {formatDateTime(adjudicatingClaim.submittedAt)}</div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                Adjudication Decision *
              </label>
              <select
                value={decision}
                onChange={(e) => setDecision(e.target.value as TdrStatus)}
                className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-orange-500 focus:outline-none font-semibold"
              >
                <option value="APPROVED">APPROVE CLAIM (Process Refund)</option>
                <option value="REJECTED">REJECT CLAIM (No Refund)</option>
                <option value="UNDER_REVIEW">MARK UNDER REVIEW</option>
              </select>
            </div>

            {decision === 'APPROVED' && (
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                  Approved Refund Amount (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  required
                  value={refundAmountInput}
                  onChange={(e) => setRefundAmountInput(Number(e.target.value))}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2.5 font-mono focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>
            )}

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setAdjudicatingClaim(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-lg shadow-xs disabled:opacity-50"
              >
                {isSubmitting ? 'Recording...' : 'Submit Decision'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
