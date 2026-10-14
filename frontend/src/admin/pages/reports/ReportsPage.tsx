import React, { useEffect, useState } from 'react';
import {
  DollarSign,
  TrendingUp,
  Percent,
  Clock,
  Download,
  LifeBuoy,
  Ticket,
} from 'lucide-react';
import { reportService } from '../../services/reportService';
import {
  BookingTrendItem,
  CancellationReportItem,
  DelayPunctualityItem,
  GrievanceMetricsItem,
  OccupancyReportItem,
  RevenueReportItem,
} from '../../types/report';
import { DataTable } from '../../components/DataTable';
import { StatusBadge } from '../../components/StatusBadge';
import { PageHeader } from '../../components/PageHeader';
import { formatCurrency, formatDate } from '../../utils/format';

type ReportTab = 'REVENUE' | 'BOOKINGS' | 'CANCELLATIONS' | 'OCCUPANCY' | 'DELAYS' | 'COMPLAINTS';

export const ReportsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ReportTab>('REVENUE');
  const [loading, setLoading] = useState(true);

  const [revenueData, setRevenueData] = useState<RevenueReportItem[]>([]);
  const [bookingTrends, setBookingTrends] = useState<BookingTrendItem[]>([]);
  const [cancellations, setCancellations] = useState<CancellationReportItem[]>([]);
  const [occupancy, setOccupancy] = useState<OccupancyReportItem[]>([]);
  const [delays, setDelays] = useState<DelayPunctualityItem[]>([]);
  const [complaints, setComplaints] = useState<GrievanceMetricsItem[]>([]);

  useEffect(() => {
    async function loadReports() {
      setLoading(true);
      try {
        const [rev, bTrends, cancels, occ, dl, cmpl] = await Promise.all([
          reportService.getRevenueReport(),
          reportService.getBookingTrends(),
          reportService.getCancellationReport(),
          reportService.getOccupancyReport(),
          reportService.getDelayReport(),
          reportService.getComplaintsReport(),
        ]);
        setRevenueData(rev);
        setBookingTrends(bTrends);
        setCancellations(cancels);
        setOccupancy(occ);
        setDelays(dl);
        setComplaints(cmpl);
      } catch (err) {
        console.error('Failed to load reports:', err);
      } finally {
        setLoading(false);
      }
    }
    loadReports();
  }, []);

  const exportCurrentCsv = () => {
    let rows: any[] = [];
    let filename = `report_${activeTab.toLowerCase()}.csv`;

    switch (activeTab) {
      case 'REVENUE':
        rows = revenueData;
        break;
      case 'BOOKINGS':
        rows = bookingTrends;
        break;
      case 'CANCELLATIONS':
        rows = cancellations;
        break;
      case 'OCCUPANCY':
        rows = occupancy;
        break;
      case 'DELAYS':
        rows = delays;
        break;
      case 'COMPLAINTS':
        rows = complaints;
        break;
    }

    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]).join(',');
    const csvContent = [headers, ...rows.map((r) => Object.values(r).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operational Reports & Business Analytics"
        description="Comprehensive analytical reporting across ticket revenues, route seat occupancy, cancellation refunds, and train punctuality."
        actions={
          <button
            onClick={exportCurrentCsv}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Export Active Report (CSV)</span>
          </button>
        }
      />

      {/* Report Tab Selector */}
      <div className="flex border-b border-slate-200 overflow-x-auto gap-2 text-xs font-semibold">
        {[
          { key: 'REVENUE', label: 'Revenue Summary', icon: DollarSign },
          { key: 'BOOKINGS', label: 'Booking Trends', icon: TrendingUp },
          { key: 'CANCELLATIONS', label: 'Cancellations & Refunds', icon: Ticket },
          { key: 'OCCUPANCY', label: 'Route Occupancy %', icon: Percent },
          { key: 'DELAYS', label: 'Punctuality & Delays', icon: Clock },
          { key: 'COMPLAINTS', label: 'Grievance Redressal', icon: LifeBuoy },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as ReportTab)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-all whitespace-nowrap ${
                isActive
                  ? 'border-orange-600 text-orange-600 font-bold bg-orange-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      {activeTab === 'REVENUE' && (
        <DataTable
          data={revenueData}
          loading={loading}
          columns={[
            {
              header: 'Train Number',
              accessorKey: 'trainNumber',
              sortable: true,
              cell: (r) => <span className="font-mono font-bold text-slate-900">{r.trainNumber}</span>,
            },
            { header: 'Train Name', accessorKey: 'trainName', sortable: true },
            {
              header: 'Travel Class',
              accessorKey: 'classType',
              sortable: true,
              cell: (r) => <span className="font-mono font-bold text-xs bg-slate-100 px-2 py-0.5 rounded">{r.classType}</span>,
            },
            { header: 'Tickets Sold', accessorKey: 'ticketCount', sortable: true },
            {
              header: 'Aggregate Revenue',
              accessorKey: 'totalRevenue',
              sortable: true,
              cell: (r) => <span className="font-mono font-bold text-slate-900">{formatCurrency(r.totalRevenue)}</span>,
            },
            { header: 'Reporting Period', accessorKey: 'period' },
          ]}
        />
      )}

      {activeTab === 'BOOKINGS' && (
        <DataTable
          data={bookingTrends}
          loading={loading}
          columns={[
            {
              header: 'Journey Date',
              accessorKey: 'date',
              sortable: true,
              cell: (r) => <span className="font-mono font-bold text-slate-900">{formatDate(r.date)}</span>,
            },
            { header: 'Total Bookings', accessorKey: 'totalBookings', sortable: true },
            {
              header: 'Confirmed',
              accessorKey: 'confirmedCount',
              sortable: true,
              cell: (r) => <span className="font-bold text-emerald-700">{r.confirmedCount}</span>,
            },
            {
              header: 'RAC Count',
              accessorKey: 'racCount',
              sortable: true,
              cell: (r) => <span className="font-bold text-amber-700">{r.racCount}</span>,
            },
            {
              header: 'Waiting List',
              accessorKey: 'waitingListCount',
              sortable: true,
              cell: (r) => <span className="font-bold text-blue-700">{r.waitingListCount}</span>,
            },
            {
              header: 'Cancelled',
              accessorKey: 'cancelledCount',
              sortable: true,
              cell: (r) => <span className="font-bold text-rose-700">{r.cancelledCount}</span>,
            },
          ]}
        />
      )}

      {activeTab === 'CANCELLATIONS' && (
        <DataTable
          data={cancellations}
          loading={loading}
          columns={[
            {
              header: 'PNR Code',
              accessorKey: 'pnr',
              sortable: true,
              cell: (r) => <span className="font-mono font-bold text-orange-800 bg-orange-50 px-2.5 py-1 rounded text-xs border border-orange-200">{r.pnr}</span>,
            },
            { header: 'Train', accessorKey: 'trainNumber' },
            {
              header: 'Cancellation Date',
              accessorKey: 'cancellationDate',
              sortable: true,
              cell: (r) => <span className="text-xs text-slate-500">{formatDate(r.cancellationDate)}</span>,
            },
            {
              header: 'Deducted Fee',
              accessorKey: 'cancellationCharge',
              cell: (r) => <span className="font-mono text-xs">{formatCurrency(r.cancellationCharge)}</span>,
            },
            {
              header: 'Processed Refund',
              accessorKey: 'refundAmount',
              sortable: true,
              cell: (r) => <span className="font-mono font-bold text-emerald-700 text-xs">{formatCurrency(r.refundAmount)}</span>,
            },
            {
              header: 'Status',
              accessorKey: 'status',
              cell: (r) => <StatusBadge status={r.status} />,
            },
          ]}
        />
      )}

      {activeTab === 'OCCUPANCY' && (
        <DataTable
          data={occupancy}
          loading={loading}
          columns={[
            {
              header: 'Train Number',
              accessorKey: 'trainNumber',
              sortable: true,
              cell: (r) => <span className="font-mono font-bold text-slate-900">{r.trainNumber}</span>,
            },
            { header: 'Train Name', accessorKey: 'trainName' },
            {
              header: 'Journey Date',
              accessorKey: 'journeyDate',
              sortable: true,
              cell: (r) => <span className="font-mono text-xs">{formatDate(r.journeyDate)}</span>,
            },
            { header: 'Class', accessorKey: 'classType' },
            {
              header: 'Occupancy Rate',
              accessorKey: 'occupancyPercentage',
              sortable: true,
              cell: (r) => (
                <div className="flex items-center gap-2">
                  <div className="w-24 bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        r.occupancyPercentage >= 80 ? 'bg-emerald-600' : 'bg-orange-600'
                      }`}
                      style={{ width: `${Math.min(r.occupancyPercentage, 100)}%` }}
                    ></div>
                  </div>
                  <span className="font-mono text-xs font-bold text-slate-900">{r.occupancyPercentage}%</span>
                </div>
              ),
            },
            {
              header: 'Booked / Total',
              cell: (r) => (
                <span className="font-mono text-xs text-slate-600">
                  {r.bookedSeats} / {r.totalCapacity}
                </span>
              ),
            },
          ]}
        />
      )}

      {activeTab === 'DELAYS' && (
        <DataTable
          data={delays}
          loading={loading}
          columns={[
            {
              header: 'Train Number',
              accessorKey: 'trainNumber',
              sortable: true,
              cell: (r) => <span className="font-mono font-bold text-slate-900">{r.trainNumber}</span>,
            },
            { header: 'Train Name', accessorKey: 'trainName' },
            {
              header: 'Journey Date',
              accessorKey: 'journeyDate',
              sortable: true,
              cell: (r) => <span className="font-mono text-xs">{formatDate(r.journeyDate)}</span>,
            },
            {
              header: 'Punctuality Status',
              accessorKey: 'status',
              sortable: true,
              cell: (r) => <StatusBadge status={r.status} />,
            },
            {
              header: 'Recorded Delay',
              accessorKey: 'delayMinutes',
              sortable: true,
              cell: (r) => (
                <span className={`font-mono text-xs font-bold ${r.delayMinutes > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                  {r.delayMinutes > 0 ? `+${r.delayMinutes} mins` : 'On Schedule'}
                </span>
              ),
            },
          ]}
        />
      )}

      {activeTab === 'COMPLAINTS' && (
        <DataTable
          data={complaints}
          loading={loading}
          columns={[
            {
              header: 'Grievance Category',
              accessorKey: 'category',
              sortable: true,
              cell: (r) => <span className="font-bold text-slate-800 text-xs">{r.category.replace(/_/g, ' ')}</span>,
            },
            { header: 'Total Filed', accessorKey: 'totalCount', sortable: true },
            {
              header: 'Resolved',
              accessorKey: 'resolvedCount',
              sortable: true,
              cell: (r) => <span className="font-bold text-emerald-700">{r.resolvedCount}</span>,
            },
            {
              header: 'In Progress',
              accessorKey: 'inProgressCount',
              sortable: true,
              cell: (r) => <span className="font-bold text-amber-700">{r.inProgressCount}</span>,
            },
            {
              header: 'Avg Resolution Turnaround',
              accessorKey: 'avgResolutionDays',
              cell: (r) => <span className="font-mono text-xs">{r.avgResolutionDays} days</span>,
            },
          ]}
        />
      )}
    </div>
  );
};
