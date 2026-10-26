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
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Adjudicate Modal State
  const [adjudicatingClaim, setAdjudicatingClaim] = useState<TdrClaim | null>(null);
  const [decision, setDecision] = useState<TdrStatus>('APPROVED');
  const [refundAmountInput, setRefundAmountInput] = useState<number>(0);
  const [remarksInput, setRemarksInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [adjudicateError, setAdjudicateError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await tdrService.getTdrClaims(
        statusFilter !== 'ALL' ? (statusFilter as TdrStatus) : undefined
      );
      setClaims(data);
    } catch (err: any) {
      console.error('Failed to load TDR claims:', err);
      setError(err.message || 'Failed to load TDR claims.');
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
    setRemarksInput('');
    setAdjudicateError(null);
  };

  const handleAdjudicateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjudicatingClaim) return;
    const refNo = adjudicatingClaim.tdrRefNo || String(adjudicatingClaim.tdrId);
    setIsSubmitting(true);
    setAdjudicateError(null);
    try {
      const result = await tdrService.adjudicateTdr(
        refNo,
        decision,
        decision === 'APPROVED' ? Number(refundAmountInput) : null,
        remarksInput.trim() || undefined
      );
      setSuccessMessage(
        `TDR claim ${refNo} was successfully ${decision.toLowerCase()}.${
          decision === 'APPROVED' && result?.refundAmount
            ? ` Refund of ₹${Number(result.refundAmount).toFixed(2)} recorded.`
            : ''
        }`
      );
      await loadData();
      setAdjudicatingClaim(null);
    } catch (err: any) {
      setAdjudicateError(err.message || 'Failed to adjudicate TDR claim.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: Column<TdrClaim>[] = [
    {
      header: 'TDR Ref #',
      accessorKey: 'tdrRefNo',
      sortable: true,
      cell: (row) => (
        <span className="font-mono font-bold text-slate-900 text-xs">
          {row.tdrRefNo || (row.tdrId ? `#${row.tdrId}` : '—')}
        </span>
      ),
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
          {row.passengerNo && <div className="text-meta font-mono">Pax #{row.passengerNo}</div>}
          {row.bookingId && <div className="text-meta font-mono">Booking #{row.bookingId}</div>}
        </div>
      ),
    },
    {
      header: 'Filed At',
      accessorKey: 'submittedAt',
      sortable: true,
      cell: (row) => <span className="text-xs text-slate-500 font-mono">{row.filedAt || row.submittedAt || '—'}</span>,
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
          {row.refundAmount !== null && row.refundAmount !== undefined ? formatCurrency(row.refundAmount) : '—'}
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

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center justify-between shadow-2xs">
          <span>{successMessage}</span>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-600 hover:text-emerald-900 ml-3 text-xs underline font-bold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      <DataTable
        data={claims}
        columns={columns}
        loading={loading}
        error={error}
        onRetry={loadData}
        searchPlaceholder="Search claims by PNR, reason..."
        emptyMessage="No TDR claims found."
      />

      {/* Adjudication Modal */}
      <Modal
        isOpen={!!adjudicatingClaim}
        onClose={() => setAdjudicatingClaim(null)}
        title={`Adjudicate TDR Claim: ${adjudicatingClaim?.tdrRefNo || '#' + adjudicatingClaim?.tdrId}`}
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

            {adjudicateError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-medium">
                {adjudicateError}
              </div>
            )}

            <div>
              <label className="form-label">
                Adjudication Decision *
              </label>
              <select
                value={decision}
                onChange={(e) => setDecision(e.target.value as TdrStatus)}
                className="form-input"
              >
                <option value="APPROVED">APPROVE CLAIM (Process Refund)</option>
                <option value="REJECTED">REJECT CLAIM (No Refund)</option>
              </select>
            </div>

            {decision === 'APPROVED' && (
              <div>
                <label className="form-label">
                  Approved Refund Amount (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={0.01}
                  required
                  value={refundAmountInput}
                  onChange={(e) => setRefundAmountInput(Number(e.target.value))}
                  className="form-input mono"
                />
              </div>
            )}

            <div>
              <label className="form-label">
                Review Remarks (Optional)
              </label>
              <textarea
                rows={2}
                value={remarksInput}
                onChange={(e) => setRemarksInput(e.target.value)}
                placeholder="Enter justification or verification notes..."
                className="form-input text-xs"
              />
            </div>

            <div className="form-section-divider flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setAdjudicatingClaim(null)}
                className="btn-ghost"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-secondary"
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

