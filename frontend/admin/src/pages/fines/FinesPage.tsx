import React, { useEffect, useState } from 'react';
import { fineService } from '../../services/fineService';
import { staffService } from '../../services/staffService';
import { Fine } from '../../types/fine';
import { Staff } from '../../types/staff';
import { DataTable, Column } from '../../components/DataTable';
import { StatusBadge } from '../../components/StatusBadge';
import { PageHeader } from '../../components/PageHeader';
import { formatCurrency, formatDateTime } from '../../utils/format';

export const FinesPage: React.FC = () => {
  const [fines, setFines] = useState<Fine[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadFines() {
      setLoading(true);
      try {
        const [fList, sList] = await Promise.all([
          fineService.getFines(),
          staffService.getStaff(),
        ]);
        setFines(fList);
        setStaffList(sList);
      } catch (err) {
        console.error('Failed to load fines:', err);
      } finally {
        setLoading(false);
      }
    }
    loadFines();
  }, []);

  const staffMap = new Map(staffList.map((s) => [s.staffId, s]));

  const totalCollected = fines
    .filter((f) => f.paymentStatus === 'PAID')
    .reduce((sum, f) => sum + f.amount, 0);

  const columns: Column<Fine>[] = [
    {
      header: 'Receipt ID',
      accessorKey: 'fineId',
      sortable: true,
      cell: (row) => <span className="font-mono font-bold text-slate-900">#{row.fineId}</span>,
    },
    {
      header: 'Offender Details',
      cell: (row) => (
        <div>
          <div className="font-semibold text-slate-900">{row.passengerName}</div>
          <div className="text-[11px] text-slate-400 font-mono">
            ID Ref: {row.idProofReference || 'None Provided'}
          </div>
        </div>
      ),
    },
    {
      header: 'Violation Reason',
      accessorKey: 'reason',
      sortable: true,
      cell: (row) => (
        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
          {row.reason.replace(/_/g, ' ')}
        </span>
      ),
    },
    {
      header: 'Issuing TC Staff',
      cell: (row) => {
        const staff = staffMap.get(row.staffId);
        return (
          <div className="text-xs text-slate-700">
            <span className="font-semibold text-slate-900">{staff?.name || `Staff #${row.staffId}`}</span>
            <div className="text-[11px] text-slate-400 font-mono">{staff?.employeeId}</div>
          </div>
        );
      },
    },
    {
      header: 'Penalty Amount',
      accessorKey: 'amount',
      sortable: true,
      cell: (row) => (
        <span className="font-mono font-bold text-slate-900 text-xs">
          {formatCurrency(row.amount)}
        </span>
      ),
    },
    {
      header: 'Payment Status',
      accessorKey: 'paymentStatus',
      sortable: true,
      cell: (row) => <StatusBadge status={row.paymentStatus} />,
    },
    {
      header: 'Issued At',
      accessorKey: 'issuedAt',
      sortable: true,
      cell: (row) => <span className="text-xs text-slate-500">{formatDateTime(row.issuedAt)}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="On-Spot Fines & Penalty Oversight"
        description="Inspect fine receipts issued on trains and platforms by Ticket Collectors."
        contractGapProposedEndpoint="GET /api/admin/fines"
      />

      {/* Summary KPI Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Total Penalty Collections</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Cleared fine receipts logged by field Ticket Collectors.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-600">Settled Penalties:</span>
          <span className="font-mono text-xl font-bold px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
            {formatCurrency(totalCollected)}
          </span>
        </div>
      </div>

      <DataTable
        data={fines}
        columns={columns}
        loading={loading}
        searchPlaceholder="Search fines by offender, TC code, violation reason..."
        emptyMessage="No fine receipts found."
      />
    </div>
  );
};
