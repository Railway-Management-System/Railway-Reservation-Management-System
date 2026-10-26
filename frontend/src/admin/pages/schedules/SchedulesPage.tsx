import React, { useEffect, useState } from 'react';
import { Plus, Clock, Trash2, X } from 'lucide-react';
import { scheduleService } from '../../services/scheduleService';
import { trainService } from '../../services/trainService';
import { Schedule } from '../../types/schedule';
import { Train } from '../../types/train';
import { ScheduleStatus } from '../../constants/enums';
import { DataTable, Column } from '../../components/DataTable';
import { StatusBadge } from '../../components/StatusBadge';
import { Modal } from '../../components/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PageHeader } from '../../components/PageHeader';
import { formatDate, formatDelay, formatCurrency, formatDateTime } from '../../utils/format';

export const SchedulesPage: React.FC = () => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [trains, setTrains] = useState<Train[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [trainNoFilter, setTrainNoFilter] = useState<string>('');
  const [fromDateFilter, setFromDateFilter] = useState<string>('');
  const [toDateFilter, setToDateFilter] = useState<string>('');
  const [selectedTrainId, setSelectedTrainId] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Success Feedback
  const [successAlert, setSuccessAlert] = useState<{
    scheduleId: number;
    trainNumber?: string;
    purgedCount: number;
    totalRefund: number;
  } | null>(null);

  // Quick Delay Updater Modal
  const [delayModalSchedule, setDelayModalSchedule] = useState<Schedule | null>(null);
  const [delayInput, setDelayInput] = useState<number>(0);
  const [statusInput, setStatusInput] = useState<ScheduleStatus>('ON_TIME');
  const [isUpdatingDelay, setIsUpdatingDelay] = useState(false);

  // Create Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newSchedule, setNewSchedule] = useState<Omit<Schedule, 'scheduleId'>>({
    trainId: 101,
    journeyDate: '2026-10-27',
    status: 'ON_TIME',
    delayMinutes: 0,
  });
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  // Delete State
  const [deletingSchedule, setDeletingSchedule] = useState<Schedule | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Chart Preparation State
  const [chartModalOpen, setChartModalOpen] = useState(false);
  const [targetScheduleId, setTargetScheduleId] = useState<number | string>('');
  const [isPreparingChart, setIsPreparingChart] = useState(false);
  const [chartResult, setChartResult] = useState<any | null>(null);
  const [chartError, setChartError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const selectedTrain = selectedTrainId !== 'ALL' ? trains.find((t) => String(t.trainId) === selectedTrainId) : null;
      const effectiveTrainNo = trainNoFilter.trim() || selectedTrain?.trainNumber || undefined;

      const [sList, tList] = await Promise.all([
        scheduleService.getSchedules({
          from_date: fromDateFilter || undefined,
          to_date: toDateFilter || undefined,
          train_no: effectiveTrainNo,
        }),
        trainService.getTrains(),
      ]);

      const filtered = statusFilter !== 'ALL' ? sList.filter((s) => s.status === statusFilter) : sList;
      setSchedules(filtered);
      setTrains(tList);
    } catch (err: any) {
      console.error('Failed to load schedules:', err);
      setError(err.message || 'Failed to load train schedules.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedTrainId, statusFilter, fromDateFilter, toDateFilter, trainNoFilter]);

  const trainMap = new Map(trains.map((t) => [t.trainId, t]));

  const handleOpenDelayModal = (schedule: Schedule) => {
    setDelayModalSchedule(schedule);
    setDelayInput(schedule.delayMinutes || 0);
    setStatusInput(schedule.status || 'ON_TIME');
  };

  const handleSaveDelay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!delayModalSchedule) return;

    setIsUpdatingDelay(true);
    try {
      const derivedStatus = delayInput > 0 && statusInput === 'ON_TIME' ? 'DELAYED' : statusInput;
      await scheduleService.updateSchedule(delayModalSchedule.scheduleId || (delayModalSchedule as any).schedule_id, {
        delayMinutes: Number(delayInput),
        status: derivedStatus,
      });
      await loadData();
      setDelayModalSchedule(null);
    } catch (err: any) {
      alert(err.message || 'Failed to update schedule delay.');
    } finally {
      setIsUpdatingDelay(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingCreate(true);
    try {
      await scheduleService.createSchedule(newSchedule);
      await loadData();
      setCreateModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to create schedule.');
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingSchedule) return;
    setIsDeleting(true);
    try {
      await scheduleService.deleteSchedule(deletingSchedule.scheduleId || (deletingSchedule as any).schedule_id);
      await loadData();
      setDeletingSchedule(null);
    } catch (err: any) {
      alert(err.message || 'Failed to delete schedule run.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePrepareChart = async (e?: React.FormEvent, directScheduleId?: number) => {
    if (e) e.preventDefault();
    const idToPrepare = directScheduleId || Number(targetScheduleId);
    if (!idToPrepare) return;

    setIsPreparingChart(true);
    setChartResult(null);
    setChartError(null);
    try {
      const res = await scheduleService.prepareChart(idToPrepare);
      setChartResult(res);
      setSuccessAlert({
        scheduleId: idToPrepare,
        trainNumber: res.trainNumber,
        purgedCount: res.summary?.waitlistedPassengersCancelled ?? 0,
        totalRefund: res.summary?.totalRefundsDisbursed ?? 0,
      });
      await loadData();
    } catch (err: any) {
      setChartError(err.message || 'Failed to prepare reservation chart.');
    } finally {
      setIsPreparingChart(false);
    }
  };

  // Check if target schedule in modal is already prepared
  const modalTargetSched = schedules.find(
    (s) => Number(s.scheduleId || s.schedule_id) === Number(targetScheduleId)
  );
  const isModalTargetAlreadyPrepared = Boolean(
    modalTargetSched?.chartPreparedAt || modalTargetSched?.chart_prepared_at
  );

  const columns: Column<Schedule>[] = [
    {
      header: 'Schedule ID',
      accessorKey: 'scheduleId',
      sortable: true,
      cell: (row) => (
        <span className="font-mono font-bold text-slate-900">
          #{row.scheduleId || row.schedule_id}
        </span>
      ),
    },
    {
      header: 'Train Service',
      cell: (row) => {
        const train = trainMap.get(row.trainId || row.train_id || 0);
        const trainNumber = row.trainNumber || row.train_number || train?.trainNumber || row.trainId;
        const trainName = row.trainName || row.train_name || train?.trainName || '';
        return (
          <div>
            <span className="font-bold text-orange-700 bg-orange-50 px-2 py-0.5 rounded text-xs border border-orange-200 tracking-tight">
              {trainNumber}
            </span>
            <div className="text-xs text-slate-700 mt-0.5 font-medium">{trainName}</div>
          </div>
        );
      },
    },
    {
      header: 'Journey Date',
      accessorKey: 'journeyDate',
      sortable: true,
      cell: (row) => (
        <span className="font-mono text-xs font-semibold text-slate-800">
          {formatDate(row.journeyDate || row.journey_date || '')}
        </span>
      ),
    },
    {
      header: 'Departure',
      cell: (row) => (
        <div className="text-xs font-mono">
          <div className="font-semibold text-slate-800">{row.departureTime || row.departure_time || '—'}</div>
          {(row.arrivalTime || row.arrival_time) && (
            <div className="text-[11px] text-slate-500">Arr: {row.arrivalTime || row.arrival_time}</div>
          )}
        </div>
      ),
    },
    {
      header: 'Chart Status',
      cell: (row) => {
        const isPrepared = Boolean(row.chartPreparedAt || row.chart_prepared_at);
        return isPrepared ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Prepared
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            Open
          </span>
        );
      },
    },
    {
      header: 'RAC & WL Counts',
      cell: (row) => {
        const racCount = row.totalRacCount ?? row.total_rac_count ?? 0;
        const wlCount = row.totalWlCount ?? row.total_wl_count ?? 0;
        return (
          <div>
            <div className="font-mono text-xs font-medium">
              <span className="text-slate-500">RAC: </span>
              <span className="font-bold text-amber-700">{racCount}</span>
              <span className="text-slate-300 mx-1">|</span>
              <span className="text-slate-500">WL: </span>
              <span className="font-bold text-rose-700">{wlCount}</span>
            </div>
            {row.classes && row.classes.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {row.classes.map((c) => (
                  <span
                    key={c.classCode || c.class_code}
                    className="inline-block px-1.5 py-0.5 text-[10px] bg-slate-100 rounded text-slate-700 border border-slate-200 font-mono"
                    title={`${c.className || c.class_name}: ${c.availableSeats ?? c.available_seats} available, RAC ${c.racCount ?? c.rac_count}/${c.racCapacity ?? c.rac_capacity}, WL ${c.wlCount ?? c.wl_count}/${c.wlCapacity ?? c.wl_capacity}`}
                  >
                    {c.classCode || c.class_code}: Avail {c.availableSeats ?? c.available_seats} (R:{c.racCount ?? c.rac_count}, W:{c.wlCount ?? c.wl_count})
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      },
    },
    {
      header: 'Running Status',
      accessorKey: 'status',
      sortable: true,
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      header: 'Recorded Delay',
      accessorKey: 'delayMinutes',
      sortable: true,
      cell: (row) => (
        <span
          className={`font-mono text-xs font-bold ${
            (row.delayMinutes || 0) > 0 ? 'text-amber-700' : 'text-emerald-700'
          }`}
        >
          {formatDelay(row.delayMinutes || 0)}
        </span>
      ),
    },
    {
      header: 'Actions',
      align: 'right',
      cell: (row) => {
        const isPrepared = Boolean(row.chartPreparedAt || row.chart_prepared_at);
        const schedId = Number(row.scheduleId || row.schedule_id || 0);
        return (
          <div className="flex items-center justify-end gap-1.5 flex-wrap">
            <button
              onClick={() => handlePrepareChart(undefined, schedId)}
              disabled={isPrepared || isPreparingChart}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors flex items-center gap-1 ${
                isPrepared
                  ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-slate-800 hover:bg-slate-700 text-white border-slate-700 cursor-pointer'
              }`}
              title={isPrepared ? 'Reservation chart already prepared' : 'Execute Chart Preparation'}
            >
              <span>{isPrepared ? 'Prepared' : 'Prepare Chart'}</span>
            </button>
            <button
              onClick={() => handleOpenDelayModal(row)}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
              title="Update Live Delay"
            >
              <Clock className="w-3.5 h-3.5 text-orange-600" />
              <span>Delay</span>
            </button>
            <button
              onClick={() => setDeletingSchedule(row)}
              className="p-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-600 transition-colors cursor-pointer"
              title="Delete Schedule"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dated Train Schedules & Delay Control"
        description="Maintain calendar train runs, monitor real-time class inventories (available / RAC / WL), prepare charts, and apply operational delay updates."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                setChartModalOpen(true);
                setChartResult(null);
                setChartError(null);
              }}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700 cursor-pointer"
            >
              <span>Prepare Chart</span>
            </button>
            <button
              onClick={() => setCreateModalOpen(true)}
              className="btn-secondary"
            >
              <Plus className="w-4 h-4" />
              <span>Schedule Run</span>
            </button>
          </div>
        }
      />

      {/* Success Banner after Chart Preparation */}
      {successAlert && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-xs flex items-center justify-between shadow-xs">
          <div className="space-y-0.5">
            <div className="font-extrabold text-emerald-950 text-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
              Reservation Chart Prepared Successfully {successAlert.trainNumber ? `(Train ${successAlert.trainNumber})` : `(Schedule #${successAlert.scheduleId})`}
            </div>
            <div className="text-emerald-900 font-medium text-xs">
              Waitlisted Passengers Purged: <span className="font-bold text-orange-700">{successAlert.purgedCount}</span> &bull; Total Refunds Disbursed: <span className="font-bold text-emerald-800">{formatCurrency(successAlert.totalRefund)}</span>
            </div>
          </div>
          <button
            onClick={() => setSuccessAlert(null)}
            className="p-1 text-emerald-700 hover:text-emerald-950 rounded-lg hover:bg-emerald-100 transition-colors cursor-pointer"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs flex flex-wrap items-center gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Train Number
          </label>
          <input
            type="text"
            placeholder="e.g. 12951"
            value={trainNoFilter}
            onChange={(e) => setTrainNoFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none w-32"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Or Select Train
          </label>
          <select
            value={selectedTrainId}
            onChange={(e) => {
              setSelectedTrainId(e.target.value);
              if (e.target.value !== 'ALL') {
                const t = trains.find((tr) => String(tr.trainId) === e.target.value);
                if (t) setTrainNoFilter(t.trainNumber);
              } else {
                setTrainNoFilter('');
              }
            }}
            className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none max-w-xs"
          >
            <option value="ALL">All Trains</option>
            {trains.map((t) => (
              <option key={t.trainId} value={t.trainId}>
                {t.trainNumber} - {t.trainName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            From Date
          </label>
          <input
            type="date"
            value={fromDateFilter}
            onChange={(e) => setFromDateFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            To Date
          </label>
          <input
            type="date"
            value={toDateFilter}
            onChange={(e) => setToDateFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Running Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="ON_TIME">ON_TIME Only</option>
            <option value="DELAYED">DELAYED Only</option>
            <option value="CANCELLED">CANCELLED Only</option>
          </select>
        </div>

        {(trainNoFilter || fromDateFilter || toDateFilter || selectedTrainId !== 'ALL' || statusFilter !== 'ALL') && (
          <div className="self-end pb-0.5">
            <button
              onClick={() => {
                setTrainNoFilter('');
                setSelectedTrainId('ALL');
                setFromDateFilter('');
                setToDateFilter('');
                setStatusFilter('ALL');
              }}
              className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg border border-rose-200 transition-colors cursor-pointer"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>

      <DataTable
        data={schedules}
        columns={columns}
        loading={loading}
        error={error}
        onRetry={loadData}
        searchPlaceholder="Search schedule by date, train, delay..."
        emptyMessage="No schedules found"
      />

      {/* Delay Adjustment Modal */}
      <Modal
        isOpen={!!delayModalSchedule}
        onClose={() => setDelayModalSchedule(null)}
        title="Update Operational Delay & Running Status"
        maxWidth="md"
      >
        {delayModalSchedule && (
          <form onSubmit={handleSaveDelay} className="space-y-4">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
              <div className="font-bold text-slate-800">
                Train: {delayModalSchedule.trainNumber || delayModalSchedule.train_number || trainMap.get(delayModalSchedule.trainId || 0)?.trainNumber} - {delayModalSchedule.trainName || delayModalSchedule.train_name || trainMap.get(delayModalSchedule.trainId || 0)?.trainName}
              </div>
              <div className="text-slate-500 font-mono">
                Date: {formatDate(delayModalSchedule.journeyDate || delayModalSchedule.journey_date)} (Schedule #{delayModalSchedule.scheduleId || delayModalSchedule.schedule_id})
              </div>
            </div>

            <div>
              <label className="form-label">
                Delay In Minutes (delayMinutes) *
              </label>
              <input
                type="number"
                min={0}
                required
                value={delayInput}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setDelayInput(val);
                  if (val > 0 && statusInput === 'ON_TIME') {
                    setStatusInput('DELAYED');
                  } else if (val === 0 && statusInput === 'DELAYED') {
                    setStatusInput('ON_TIME');
                  }
                }}
                className="form-input mono"
              />
              <p className="mt-1 text-meta">
                0 = On Time. Greater than 0 marks delay automatically.
              </p>
            </div>

            <div>
              <label className="form-label">
                Schedule Running Status *
              </label>
              <select
                value={statusInput}
                onChange={(e) => setStatusInput(e.target.value as ScheduleStatus)}
                className="form-input"
              >
                <option value="ON_TIME">ON_TIME</option>
                <option value="DELAYED">DELAYED</option>
                <option value="CANCELLED">CANCELLED</option>
                <option value="RESCHEDULED">RESCHEDULED</option>
              </select>
            </div>

            <div className="form-section-divider flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDelayModalSchedule(null)}
                className="btn-ghost"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUpdatingDelay}
                className="btn-secondary"
              >
                {isUpdatingDelay ? 'Saving...' : 'Update Delay'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Create New Dated Schedule Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Schedule New Train Run"
        maxWidth="md"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div>
            <label className="form-label">
              Train Service *
            </label>
            <select
              value={newSchedule.trainId}
              onChange={(e) => setNewSchedule({ ...newSchedule, trainId: Number(e.target.value) })}
              className="form-input"
            >
              {trains.map((t) => (
                <option key={t.trainId} value={t.trainId}>
                  {t.trainNumber} - {t.trainName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">
              Journey Date (YYYY-MM-DD) *
            </label>
            <input
              type="date"
              required
              value={newSchedule.journeyDate}
              onChange={(e) => setNewSchedule({ ...newSchedule, journeyDate: e.target.value })}
              className="form-input mono"
            />
          </div>

          <div>
            <label className="form-label">
              Initial Status
            </label>
            <select
              value={newSchedule.status}
              onChange={(e) =>
                setNewSchedule({ ...newSchedule, status: e.target.value as ScheduleStatus })
              }
              className="form-input"
            >
              <option value="ON_TIME">ON_TIME</option>
              <option value="DELAYED">DELAYED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>

          <div className="form-section-divider flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="btn-ghost"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingCreate}
              className="btn-secondary"
            >
              {isSubmittingCreate ? 'Saving...' : 'Create Run'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deletingSchedule}
        title="Delete Dated Schedule"
        message={`Are you sure you want to delete dated run #${deletingSchedule?.scheduleId || deletingSchedule?.schedule_id} on ${deletingSchedule?.journeyDate || deletingSchedule?.journey_date}?`}
        confirmLabel="Delete Schedule"
        isDestructive={true}
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeletingSchedule(null)}
      />

      {/* Prepare Chart Modal */}
      <Modal
        isOpen={chartModalOpen}
        onClose={() => setChartModalOpen(false)}
        title="Execute Chart Preparation"
        maxWidth="md"
      >
        <form onSubmit={(e) => handlePrepareChart(e)} className="space-y-4">
          <p className="text-xs text-slate-500">
            Execute final chart preparation for a train run (Contract 7.2). This allocates confirmed berths to RAC and Waitlisted passengers according to reservation priority rules and purges waitlisted passengers.
          </p>

          <div>
            <label className="form-label">
              Schedule ID (scheduleId) *
            </label>
            <input
              type="number"
              required
              min={1}
              value={targetScheduleId}
              onChange={(e) => setTargetScheduleId(e.target.value)}
              placeholder="e.g. 1001"
              className="form-input mono"
            />
            {isModalTargetAlreadyPrepared && (
              <p className="mt-1 text-xs text-amber-700 font-medium">
                Note: Reservation chart is already prepared for schedule #{targetScheduleId}.
              </p>
            )}
          </div>

          {chartError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
              {chartError}
            </div>
          )}

          {chartResult && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-emerald-200">
                <span className="font-extrabold text-emerald-900 text-sm">
                  Reservation Chart Prepared {chartResult.alreadyPrepared ? '(Pre-existing Result)' : 'Successfully'}
                </span>
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-emerald-200 text-emerald-900">
                  {chartResult.trainNumber ? `Train #${chartResult.trainNumber}` : `Schedule #${chartResult.scheduleId}`}
                </span>
              </div>

              {chartResult.summary && (
                <div className="grid grid-cols-2 gap-2 text-emerald-950 font-medium">
                  <div className="p-2.5 rounded-lg bg-white/80 border border-emerald-200">
                    <span className="text-[11px] text-slate-500 block">WL Purged & Cancelled</span>
                    <span className="font-bold text-sm text-orange-700">
                      {chartResult.summary.waitlistedPassengersCancelled ?? chartResult.totalWaitlistedPromoted ?? 0} pax
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/80 border border-emerald-200">
                    <span className="text-[11px] text-slate-500 block">Total Refunds Disbursed</span>
                    <span className="font-bold text-sm text-emerald-800">
                      {formatCurrency(chartResult.summary.totalRefundsDisbursed ?? 0)}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/80 border border-emerald-200">
                    <span className="text-[11px] text-slate-500 block">Active Holds Cancelled</span>
                    <span className="font-bold text-sm text-slate-800">
                      {chartResult.summary.activeHoldsCancelled ?? 0}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/80 border border-emerald-200">
                    <span className="text-[11px] text-slate-500 block">Unused Quota Seats Released</span>
                    <span className="font-bold text-sm text-slate-800">
                      {chartResult.summary.unusedQuotaSeatsReleased ?? 0}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/80 border border-emerald-200">
                    <span className="text-[11px] text-slate-500 block">Auto-Upgrades Processed</span>
                    <span className="font-bold text-sm text-slate-800">
                      {chartResult.summary.autoUpgradesProcessed ?? 0}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/80 border border-emerald-200">
                    <span className="text-[11px] text-slate-500 block">Chart Snapshots Persisted</span>
                    <span className="font-bold text-sm text-slate-800">
                      {chartResult.summary.chartSnapshotRowsPersisted ?? chartResult.totalConfirmed ?? 0} rows
                    </span>
                  </div>
                </div>
              )}

              {(chartResult.chartPreparedAt || chartResult.preparedAt) && (
                <div className="text-slate-500 text-[11px] font-mono pt-1">
                  Prepared At: {formatDateTime(chartResult.chartPreparedAt || chartResult.preparedAt)}
                </div>
              )}
            </div>
          )}

          <div className="form-section-divider flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setChartModalOpen(false)}
              className="btn-ghost"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={isPreparingChart || !targetScheduleId || isModalTargetAlreadyPrepared}
              className={`btn-secondary ${isModalTargetAlreadyPrepared ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isPreparingChart ? 'Executing...' : isModalTargetAlreadyPrepared ? 'Already Prepared' : 'Prepare Chart'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
