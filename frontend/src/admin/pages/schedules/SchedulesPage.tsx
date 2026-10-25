import React, { useEffect, useState } from 'react';
import { Plus, Clock, Trash2 } from 'lucide-react';
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
import { formatDate, formatDelay } from '../../utils/format';

export const SchedulesPage: React.FC = () => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [trains, setTrains] = useState<Train[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedTrainId, setSelectedTrainId] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Quick Delay Updater Modal
  const [delayModalSchedule, setDelayModalSchedule] = useState<Schedule | null>(null);
  const [delayInput, setDelayInput] = useState<number>(0);
  const [statusInput, setStatusInput] = useState<ScheduleStatus>('ON_TIME');
  const [isUpdatingDelay, setIsUpdatingDelay] = useState(false);

  // Create Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newSchedule, setNewSchedule] = useState<Omit<Schedule, 'scheduleId'>>({
    trainId: 101,
    journeyDate: '2026-10-15',
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
    try {
      const [sList, tList] = await Promise.all([
        scheduleService.getSchedules(selectedTrainId !== 'ALL' ? Number(selectedTrainId) : undefined),
        trainService.getTrains(),
      ]);

      const filtered = statusFilter !== 'ALL' ? sList.filter((s) => s.status === statusFilter) : sList;
      setSchedules(filtered);
      setTrains(tList);
    } catch (err) {
      console.error('Failed to load schedules:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedTrainId, statusFilter]);

  const trainMap = new Map(trains.map((t) => [t.trainId, t]));

  const handleOpenDelayModal = (schedule: Schedule) => {
    setDelayModalSchedule(schedule);
    setDelayInput(schedule.delayMinutes);
    setStatusInput(schedule.status);
  };

  const handleSaveDelay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!delayModalSchedule) return;

    setIsUpdatingDelay(true);
    try {
      const derivedStatus = delayInput > 0 && statusInput === 'ON_TIME' ? 'DELAYED' : statusInput;
      await scheduleService.updateSchedule(delayModalSchedule.scheduleId, {
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
      await scheduleService.deleteSchedule(deletingSchedule.scheduleId);
      await loadData();
      setDeletingSchedule(null);
    } catch (err: any) {
      alert(err.message || 'Failed to delete schedule run.');
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: Column<Schedule>[] = [
    {
      header: 'Schedule ID',
      accessorKey: 'scheduleId',
      sortable: true,
      cell: (row) => <span className="font-mono font-bold text-slate-900">#{row.scheduleId}</span>,
    },
    {
      header: 'Train Service',
      cell: (row) => {
        const train = trainMap.get(row.trainId);
        return (
          <div>
            <span className="font-bold text-orange-700 bg-orange-50 px-2 py-0.5 rounded text-xs border border-orange-200 tracking-tight">
              {train?.trainNumber || row.trainId}
            </span>
            <div className="text-xs text-slate-700 mt-0.5 font-medium">{train?.trainName}</div>
          </div>
        );
      },
    },
    {
      header: 'Departure Date',
      accessorKey: 'journeyDate',
      sortable: true,
      cell: (row) => (
        <span className="font-mono text-xs font-semibold text-slate-800">
          {formatDate(row.journeyDate)}
        </span>
      ),
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
            row.delayMinutes > 0 ? 'text-amber-700' : 'text-emerald-700'
          }`}
        >
          {formatDelay(row.delayMinutes)}
        </span>
      ),
    },
    {
      header: 'Actions',
      align: 'right',
      cell: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => handleOpenDelayModal(row)}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors flex items-center gap-1"
            title="Update Live Delay"
          >
            <Clock className="w-3.5 h-3.5 text-orange-600" />
            <span>Delay Status</span>
          </button>
          <button
            onClick={() => setDeletingSchedule(row)}
            className="p-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-600 transition-colors"
            title="Delete Schedule"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  const handlePrepareChart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetScheduleId) return;
    setIsPreparingChart(true);
    setChartResult(null);
    setChartError(null);
    try {
      const res = await scheduleService.prepareChart(Number(targetScheduleId));
      setChartResult(res);
    } catch (err: any) {
      setChartError(err.message || 'Failed to prepare reservation chart.');
    } finally {
      setIsPreparingChart(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dated Train Schedules & Delay Control"
        description="Maintain calendar train runs, monitor running statuses (ON_TIME / DELAYED / CANCELLED), and apply operational delay updates."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                setChartModalOpen(true);
                setChartResult(null);
                setChartError(null);
              }}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700"
            >
              <span>Prepare Chart</span>
            </button>
            <select
              value={selectedTrainId}
              onChange={(e) => setSelectedTrainId(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-700 focus:ring-2 focus:ring-orange-500 focus:outline-none"
            >
              <option value="ALL">All Trains</option>
              {trains.map((t) => (
                <option key={t.trainId} value={t.trainId}>
                  {t.trainNumber} - {t.trainName}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-700 focus:ring-2 focus:ring-orange-500 focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="ON_TIME">ON_TIME Only</option>
              <option value="DELAYED">DELAYED Only</option>
              <option value="CANCELLED">CANCELLED Only</option>
            </select>
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


      <DataTable
        data={schedules}
        columns={columns}
        loading={loading}
        searchPlaceholder="Search schedule by date, train, delay..."
        emptyMessage="No train schedules found."
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
                Train: {trainMap.get(delayModalSchedule.trainId)?.trainNumber} - {trainMap.get(delayModalSchedule.trainId)?.trainName}
              </div>
              <div className="text-slate-500 font-mono">
                Date: {formatDate(delayModalSchedule.journeyDate)} (Schedule #{delayModalSchedule.scheduleId})
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
        message={`Are you sure you want to delete dated run #${deletingSchedule?.scheduleId} on ${deletingSchedule?.journeyDate}?`}
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
        <form onSubmit={handlePrepareChart} className="space-y-4">
          <p className="text-xs text-slate-500">
            Execute final chart preparation for a train run (Contract 7.2). This allocates confirmed berths to RAC and Waitlisted passengers according to reservation priority rules.
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
              placeholder="e.g. 101"
              className="form-input mono"
            />
          </div>

          {chartError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
              {chartError}
            </div>
          )}

          {chartResult && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs space-y-1">
              <div className="font-bold text-emerald-800">
                Chart Status: {chartResult.status} {chartResult.alreadyPrepared ? '(Already Prepared)' : ''}
              </div>
              <div className="text-emerald-700">
                Confirmed Berths: <span className="font-bold">{chartResult.totalConfirmed ?? '—'}</span>
              </div>
              <div className="text-emerald-700">
                RAC Promoted: <span className="font-bold">{chartResult.totalRacPromoted ?? 0}</span>
              </div>
              <div className="text-emerald-700">
                WL Promoted: <span className="font-bold">{chartResult.totalWaitlistedPromoted ?? 0}</span>
              </div>
              {chartResult.preparedAt && (
                <div className="text-slate-500 text-[11px] font-mono">
                  Prepared At: {chartResult.preparedAt}
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
              disabled={isPreparingChart || !targetScheduleId}
              className="btn-secondary"
            >
              {isPreparingChart ? 'Executing...' : 'Prepare Chart'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

