import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  Eye,
  Edit,
  Ban,
  AlertCircle,
  Activity,
} from 'lucide-react';
import { bookingService } from '../../services/bookingService';
import { trainService } from '../../services/trainService';
import { Booking, BookingDetail } from '../../types/booking';
import { Train } from '../../types/train';
import { BookingStatus,  } from '../../constants/enums';
import { DataTable, Column } from '../../components/DataTable';
import { StatusBadge } from '../../components/StatusBadge';
import { Modal } from '../../components/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PageHeader } from '../../components/PageHeader';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/format';

export const BookingsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialPnr = searchParams.get('pnr') || '';

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [trains, setTrains] = useState<Train[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [pnrFilter, setPnrFilter] = useState(initialPnr);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [trainFilter, setTrainFilter] = useState<string>('ALL');

  // Selected Booking Detail Modal State
  const [selectedPnr, setSelectedPnr] = useState<string | null>(initialPnr || null);
  const [bookingDetail, setBookingDetail] = useState<BookingDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Override Modal State
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [overrideStatus, setOverrideStatus] = useState<BookingStatus>('CONFIRMED');
  const [isSubmittingOverride, setIsSubmittingOverride] = useState(false);

  // Admin Cancel Confirm Dialog State
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  // Live Availability Modal State
  const [availModalTrainId, setAvailModalTrainId] = useState<number | null>(null);
  const [availDate, setAvailDate] = useState<string>('2026-10-10');
  const [availResults, setAvailResults] = useState<any[]>([]);
  const [loadingAvail, setLoadingAvail] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [bList, tList] = await Promise.all([
        bookingService.getBookings({
          pnr: pnrFilter || undefined,
          bookingStatus: statusFilter !== 'ALL' ? (statusFilter as BookingStatus) : undefined,
          trainId: trainFilter !== 'ALL' ? Number(trainFilter) : undefined,
        }),
        trainService.getTrains(),
      ]);
      setBookings(bList);
      setTrains(tList);
    } catch (err) {
      console.error('Failed to load bookings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, trainFilter]);

  // Load detailed ticket when selectedPnr changes
  useEffect(() => {
    if (selectedPnr) {
      setLoadingDetail(true);
      bookingService
        .getBookingByPnr(selectedPnr)
        .then((detail) => setBookingDetail(detail))
        .catch((err) => {
          console.error('Failed to load booking detail:', err);
          setBookingDetail(null);
        })
        .finally(() => setLoadingDetail(false));
    } else {
      setBookingDetail(null);
    }
  }, [selectedPnr]);

  const trainMap = new Map(trains.map((t) => [t.trainId, t]));

  const handleApplyPnrSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleOpenOverride = () => {
    if (!bookingDetail) return;
    setOverrideStatus(bookingDetail.bookingStatus);
    setIsOverrideModalOpen(true);
  };

  const handleSaveOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingDetail) return;
    setIsSubmittingOverride(true);
    try {
      await bookingService.overrideBooking(bookingDetail.pnr, {
        bookingStatus: overrideStatus,
      });
      await loadData();
      const updated = await bookingService.getBookingByPnr(bookingDetail.pnr);
      setBookingDetail(updated);
      setIsOverrideModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to override booking status.');
    } finally {
      setIsSubmittingOverride(false);
    }
  };

  const handleCancelBooking = async () => {
    if (!bookingDetail) return;
    setIsCancelling(true);
    try {
      const res = await bookingService.cancelBooking(bookingDetail.pnr);
      await loadData();
      const updated = await bookingService.getBookingByPnr(bookingDetail.pnr);
      setBookingDetail(updated);
      setIsCancelConfirmOpen(false);
      alert(`Booking cancelled successfully. Refund issued: ₹${res.refundAmount.toFixed(2)}`);
    } catch (err: any) {
      alert(err.message || 'Failed to cancel booking.');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleOpenAvailability = (trainId: number, date: string) => {
    setAvailModalTrainId(trainId);
    setAvailDate(date);
    setLoadingAvail(true);
    trainService
      .getTrainAvailability(trainId, date)
      .then((res) => setAvailResults(res))
      .catch((err) => console.error(err))
      .finally(() => setLoadingAvail(false));
  };

  const columns: Column<Booking>[] = [
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
      header: 'Train Service',
      cell: (row) => {
        const train = trainMap.get(row.trainId);
        return (
          <div>
            <span className="font-bold text-slate-900">{train?.trainNumber || row.trainId}</span>
            <div className="text-xs text-slate-500 truncate max-w-xs">{train?.trainName}</div>
          </div>
        );
      },
    },
    {
      header: 'Travel Details',
      cell: (row) => (
        <div className="text-xs text-slate-700">
          <div>Date: {formatDate(row.journeyDate)}</div>
          <div className="text-slate-500 font-mono">
            Class: {row.classType} · Quota: {row.quota}
          </div>
        </div>
      ),
    },
    {
      header: 'Total Fare',
      accessorKey: 'totalFare',
      sortable: true,
      cell: (row) => <span className="font-bold text-slate-900 text-xs">{formatCurrency(row.totalFare)}</span>,
    },
    {
      header: 'Booking Status',
      accessorKey: 'bookingStatus',
      sortable: true,
      cell: (row) => <StatusBadge status={row.bookingStatus} />,
    },
    {
      header: 'Actions',
      align: 'right',
      cell: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => setSelectedPnr(row.pnr)}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors flex items-center gap-1"
            title="Inspect Ticket Details"
          >
            <Eye className="w-3.5 h-3.5 text-slate-500" />
            <span>Inspect</span>
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reservation Management & Global PNR Oversight"
        description="Comprehensive ticket inspection, passenger allocation manifest, administrative status override, and refund cancellations."
      />

      {/* Filter and PNR Quick Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <form onSubmit={handleApplyPnrSearch} className="flex gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={pnrFilter}
              onChange={(e) => setPnrFilter(e.target.value)}
              placeholder="Search exact 10-digit PNR..."
              className="w-full pl-9 pr-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-semibold"
          >
            Search
          </button>
        </form>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-700 focus:ring-2 focus:ring-orange-500 focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="CONFIRMED">CONFIRMED</option>
            <option value="RAC">RAC</option>
            <option value="WAITING_LIST">WAITING_LIST</option>
            <option value="CANCELLED">CANCELLED</option>
            <option value="PAYMENT_PENDING">PAYMENT_PENDING</option>
            <option value="FAILED">FAILED</option>
          </select>

          <select
            value={trainFilter}
            onChange={(e) => setTrainFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-700 focus:ring-2 focus:ring-orange-500 focus:outline-none"
          >
            <option value="ALL">All Trains</option>
            {trains.map((t) => (
              <option key={t.trainId} value={t.trainId}>
                {t.trainNumber} - {t.trainName}
              </option>
            ))}
          </select>
        </div>
      </div>

      <DataTable
        data={bookings}
        columns={columns}
        loading={loading}
        searchPlaceholder="Filter reservation list..."
        emptyMessage="No reservations match the query."
      />

      {/* Ticket Details & Administrative Action Drawer */}
      <Modal
        isOpen={!!selectedPnr}
        onClose={() => setSelectedPnr(null)}
        title={bookingDetail ? `PNR Inspection: ${bookingDetail.pnr}` : 'Ticket Details'}
        maxWidth="xl"
      >
        {loadingDetail ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2">
            <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs text-slate-400">Loading comprehensive ticket itinerary...</p>
          </div>
        ) : bookingDetail ? (
          <div className="space-y-6">
            {/* Top Summary Banner */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Passenger Name Record (PNR)
                </span>
                <div className="text-2xl font-mono font-extrabold text-slate-900">
                  {bookingDetail.pnr}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Booked on {formatDateTime(bookingDetail.createdAt)} by {bookingDetail.userName || `User #${bookingDetail.userId}`}
                </div>
              </div>
              <div className="flex flex-col sm:items-end gap-1.5">
                <StatusBadge status={bookingDetail.bookingStatus} size="md" />
                <span className="font-mono text-base font-bold text-slate-900">
                  {formatCurrency(bookingDetail.totalFare)}
                </span>
              </div>
            </div>

            {/* Train and Travel Leg */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-white border border-slate-200 rounded-lg">
                <span className="font-bold text-slate-500 uppercase block mb-1">Train & Route</span>
                <p className="font-bold text-slate-900 text-sm">
                  {bookingDetail.trainNumber} - {bookingDetail.trainName}
                </p>
                <p className="text-slate-600 mt-1">
                  Origin Code: <span className="font-mono font-semibold">{bookingDetail.boardingStationCode}</span> → Destination Code: <span className="font-mono font-semibold">{bookingDetail.destinationStationCode}</span>
                </p>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-lg">
                <span className="font-bold text-slate-500 uppercase block mb-1">Journey Parameters</span>
                <p className="font-semibold text-slate-800">
                  Departure: {formatDate(bookingDetail.journeyDate)}
                </p>
                <p className="text-slate-600 mt-1">
                  Class: <span className="font-semibold">{bookingDetail.classType}</span> · Quota: <span className="font-semibold">{bookingDetail.quota}</span>
                </p>
              </div>
            </div>

            {/* Passenger Manifest Line Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Passenger Manifest ({bookingDetail.passengers.length} Booked)
                </h4>
                <button
                  type="button"
                  onClick={() =>
                    handleOpenAvailability(bookingDetail.trainId, bookingDetail.journeyDate)
                  }
                  className="text-xs text-orange-600 hover:underline font-semibold flex items-center gap-1"
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>Lookup Availability Counters</span>
                </button>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 font-semibold uppercase border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Passenger</th>
                      <th className="p-2.5">Coach</th>
                      <th className="p-2.5">Seat</th>
                      <th className="p-2.5">Berth</th>
                      <th className="p-2.5">Passenger Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bookingDetail.passengers.map((p, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70">
                        <td className="p-2.5 font-medium text-slate-900">{p.name}</td>
                        <td className="p-2.5 font-mono font-bold text-slate-800">
                          {p.coachNumber || '—'}
                        </td>
                        <td className="p-2.5 font-mono font-bold text-slate-800">
                          {p.seatNumber || '—'}
                        </td>
                        <td className="p-2.5 text-slate-600">{p.berthType || 'None'}</td>
                        <td className="p-2.5">
                          <StatusBadge status={p.passengerStatus} size="sm" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Payment Record & Cancellation Context */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="font-bold text-slate-500 uppercase block mb-1">
                  Settlement Record
                </span>
                {bookingDetail.payment ? (
                  <div className="space-y-1 font-mono text-[11px] text-slate-700">
                    <div>Txn ID: {bookingDetail.payment.gatewayTransactionId}</div>
                    <div>Mode: {bookingDetail.payment.paymentMode}</div>
                    <div>Status: <StatusBadge status={bookingDetail.payment.paymentStatus} size="sm" /></div>
                  </div>
                ) : (
                  <span className="text-slate-400">No payment transaction settled.</span>
                )}
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="font-bold text-slate-500 uppercase block mb-1">
                  Dispute & Cancellation
                </span>
                {bookingDetail.cancellation ? (
                  <div className="space-y-1 text-slate-700">
                    <div>Charge: ₹{bookingDetail.cancellation.cancellationCharge.toFixed(2)}</div>
                    <div>Refund: <span className="font-bold text-emerald-700">₹{bookingDetail.cancellation.refundAmount.toFixed(2)}</span></div>
                    <div>Date: {formatDateTime(bookingDetail.cancellation.cancellationDate)}</div>
                  </div>
                ) : bookingDetail.tdr ? (
                  <div className="space-y-1 text-slate-700">
                    <div>TDR Filed: <StatusBadge status={bookingDetail.tdr.status} size="sm" /></div>
                    <div className="text-[11px] text-slate-500">Reason: {bookingDetail.tdr.reason}</div>
                  </div>
                ) : (
                  <span className="text-slate-400">Ticket active in good standing.</span>
                )}
              </div>
            </div>

            {/* Administrative Action Buttons */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setSelectedPnr(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
              >
                Close Drawer
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenOverride}
                  className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-2xs flex items-center gap-1.5"
                >
                  <Edit className="w-3.5 h-3.5 text-orange-600" />
                  <span>Administrative Override</span>
                </button>
                {bookingDetail.bookingStatus !== 'CANCELLED' && (
                  <button
                    type="button"
                    onClick={() => setIsCancelConfirmOpen(true)}
                    className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-2xs flex items-center gap-1.5"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>Cancel Ticket & Refund</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Admin Override Modal */}
      <Modal
        isOpen={isOverrideModalOpen}
        onClose={() => setIsOverrideModalOpen(false)}
        title={`Administrative Override - PNR ${bookingDetail?.pnr}`}
        maxWidth="md"
      >
        <form onSubmit={handleSaveOverride} className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <span>
              Directly override booking status for manual intervention, chart discrepancies, or operational rerouting.
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
              Select Override Status *
            </label>
            <select
              value={overrideStatus}
              onChange={(e) => setOverrideStatus(e.target.value as BookingStatus)}
              className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-orange-500 focus:outline-none"
            >
              <option value="CONFIRMED">CONFIRMED</option>
              <option value="RAC">RAC</option>
              <option value="WAITING_LIST">WAITING_LIST</option>
              <option value="CANCELLED">CANCELLED</option>
              <option value="FAILED">FAILED</option>
            </select>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsOverrideModalOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingOverride}
              className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-lg shadow-xs disabled:opacity-50"
            >
              {isSubmittingOverride ? 'Saving...' : 'Execute Override'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Cancellation Confirm Dialog */}
      <ConfirmDialog
        isOpen={isCancelConfirmOpen}
        title="Administrative Ticket Cancellation"
        message={`Are you sure you want to cancel PNR ${bookingDetail?.pnr}? Standard railway cancellation fee (₹120) will be deducted and ₹${Math.max(
          0,
          (bookingDetail?.totalFare || 0) - 120
        ).toFixed(2)} will be scheduled for refund.`}
        confirmLabel="Cancel PNR & Issue Refund"
        isDestructive={true}
        isLoading={isCancelling}
        onConfirm={handleCancelBooking}
        onCancel={() => setIsCancelConfirmOpen(false)}
      />

      {/* Live Availability Lookup Modal */}
      <Modal
        isOpen={!!availModalTrainId}
        onClose={() => setAvailModalTrainId(null)}
        title="Live Train Availability Lookup"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
            <div className="font-bold text-slate-800">
              Train #{availModalTrainId} on {formatDate(availDate)}
            </div>
          </div>

          {loadingAvail ? (
            <div className="py-8 text-center text-xs text-slate-400">Querying availability...</div>
          ) : availResults.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">No availability tokens found.</div>
          ) : (
            <div className="space-y-2">
              {availResults.map((av, idx) => (
                <div key={idx} className="p-3 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-900 font-mono">Class {av.classType}</span>
                    <span className="text-slate-400 ml-2 font-mono">Quota: {av.quota}</span>
                  </div>
                  <div className="flex items-center gap-3 font-mono">
                    <span className="text-emerald-700 font-bold">{av.availableSeats} Confirmed</span>
                    <span className="text-amber-700 font-bold">{av.racCount} RAC</span>
                    <span className="text-blue-700 font-bold">{av.waitingListCount} WL</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="button"
              onClick={() => setAvailModalTrainId(null)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
