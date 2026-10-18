import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { routeService } from '../../services/routeService';
import { trainService } from '../../services/trainService';
import { stationService } from '../../services/stationService';
import { RouteStop } from '../../types/route';
import { Train } from '../../types/train';
import { Station } from '../../types/station';
import { DataTable, Column } from '../../components/DataTable';
import { Modal } from '../../components/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PageHeader } from '../../components/PageHeader';

export const RoutesPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const trainIdParam = searchParams.get('trainId');

  const [routes, setRoutes] = useState<RouteStop[]>([]);
  const [trains, setTrains] = useState<Train[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedTrainId, setSelectedTrainId] = useState<string>(trainIdParam || 'ALL');
  const [loading, setLoading] = useState(true);

  // Create / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStop, setEditingStop] = useState<RouteStop | null>(null);
  const [formData, setFormData] = useState<Omit<RouteStop, 'routeId'>>({
    trainId: 101,
    stationId: 1,
    stopSequence: 1,
    arrivalTime: '12:00',
    departureTime: '12:10',
    distanceFromOrigin: 0,
    platformNumber: 1,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete State
  const [deletingStop, setDeletingStop] = useState<RouteStop | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tList, sList] = await Promise.all([
        trainService.getTrains(),
        stationService.getStations(),
      ]);
      setTrains(tList);
      setStations(sList);

      const tId = selectedTrainId !== 'ALL' ? Number(selectedTrainId) : undefined;
      const rList = await routeService.getRoutes(tId);
      setRoutes(rList);
    } catch (err) {
      console.error('Failed to load routes data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedTrainId]);

  const trainMap = new Map(trains.map((t) => [t.trainId, t]));
  const stationMap = new Map(stations.map((s) => [s.stationId, s]));

  const handleTrainFilterChange = (val: string) => {
    setSelectedTrainId(val);
    if (val === 'ALL') {
      searchParams.delete('trainId');
      setSearchParams(searchParams);
    } else {
      setSearchParams({ trainId: val });
    }
  };

  const handleOpenCreate = () => {
    setEditingStop(null);
    const defaultTrain = selectedTrainId !== 'ALL' ? Number(selectedTrainId) : trains[0]?.trainId || 101;
    const existingStops = routes.filter((r) => r.trainId === defaultTrain);
    const nextSeq = existingStops.length > 0 ? Math.max(...existingStops.map((r) => r.stopSequence)) + 1 : 1;

    setFormData({
      trainId: defaultTrain,
      stationId: stations[0]?.stationId || 1,
      stopSequence: nextSeq,
      arrivalTime: '10:00',
      departureTime: '10:10',
      distanceFromOrigin: existingStops.length > 0 ? Math.max(...existingStops.map((r) => r.distanceFromOrigin)) + 150 : 0,
      platformNumber: 1,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (stop: RouteStop) => {
    setEditingStop(stop);
    setFormData({
      trainId: stop.trainId,
      stationId: stop.stationId,
      stopSequence: stop.stopSequence,
      arrivalTime: stop.arrivalTime,
      departureTime: stop.departureTime,
      distanceFromOrigin: stop.distanceFromOrigin,
      platformNumber: stop.platformNumber,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingStop) {
        await routeService.updateRouteStop(editingStop.routeId, formData);
      } else {
        await routeService.createRouteStop(formData);
      }
      await loadData();
      setIsModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to save route stop.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingStop) return;
    setIsDeleting(true);
    try {
      await routeService.deleteRouteStop(deletingStop.routeId);
      await loadData();
      setDeletingStop(null);
    } catch (err: any) {
      alert(err.message || 'Failed to delete route stop.');
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: Column<RouteStop>[] = [
    {
      header: 'Sequence',
      accessorKey: 'stopSequence',
      sortable: true,
      cell: (row) => (
        <span className="font-extrabold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md text-xs border border-slate-200/60">
          #{row.stopSequence}
        </span>
      ),
    },
    {
      header: 'Train Service',
      cell: (row) => {
        const train = trainMap.get(row.trainId);
        return (
          <div>
            <div className="font-bold text-slate-900 cell-primary">{train?.trainNumber || row.trainId}</div>
            <div className="text-meta font-medium truncate max-w-xs">{train?.trainName}</div>
          </div>
        );
      },
    },
    {
      header: 'Halt Station',
      cell: (row) => {
        const station = stationMap.get(row.stationId);
        return (
          <div>
            <span className="font-bold text-orange-700 bg-orange-50 px-2 py-0.5 rounded text-[11px] border border-orange-200/80 tracking-wider">
              {station?.stationCode || `STN-${row.stationId}`}
            </span>
            <div className="text-xs text-slate-700 font-medium mt-0.5">{station?.stationName}</div>
          </div>
        );
      },
    },
    {
      header: 'Timetable (24h)',
      cell: (row) => (
        <div className="text-xs text-slate-700 font-medium">
          <div><span className="text-meta">Arr:</span> {row.arrivalTime}</div>
          <div><span className="text-meta">Dep:</span> {row.departureTime}</div>
        </div>
      ),
    },
    {
      header: 'Cumulative Distance',
      accessorKey: 'distanceFromOrigin',
      sortable: true,
      cell: (row) => <span className="text-xs font-semibold text-slate-700">{row.distanceFromOrigin} km</span>,
    },
    {
      header: 'Platform',
      accessorKey: 'platformNumber',
      cell: (row) => (
        <span className="font-bold text-xs text-slate-800">PF #{row.platformNumber}</span>
      ),
    },
    {
      header: 'Actions',
      align: 'right',
      cell: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => handleOpenEdit(row)}
            className="btn-icon"
            title="Edit Stop"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setDeletingStop(row)}
            className="p-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-600 transition-colors"
            title="Delete Stop"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Route Stop Sequence Timetable"
        description="Maintain 1-indexed ordered station stops, cumulative distances (km), arrival/departure timings, and platform allocations."
        actions={
          <div className="flex items-center gap-3">
            <select
              value={selectedTrainId}
              onChange={(e) => handleTrainFilterChange(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-700 focus:ring-2 focus:ring-orange-500 focus:outline-none"
            >
              <option value="ALL">All Trains</option>
              {trains.map((t) => (
                <option key={t.trainId} value={t.trainId}>
                  {t.trainNumber} - {t.trainName}
                </option>
              ))}
            </select>
            <button
              onClick={handleOpenCreate}
              className="btn-secondary"
            >
              <Plus className="w-4 h-4" />
              <span>Add Stop</span>
            </button>
          </div>
        }
      />

      <DataTable
        data={routes}
        columns={columns}
        loading={loading}
        searchPlaceholder="Search routes by train number, station code, or sequence..."
        emptyMessage="No route stops found."
      />

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingStop ? 'Edit Route Stop Sequence' : 'Add Route Stop'}
        maxWidth="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label">
              Train Service *
            </label>
            <select
              value={formData.trainId}
              onChange={(e) => setFormData({ ...formData, trainId: Number(e.target.value) })}
              className="form-input"
            >
              {trains.map((t) => (
                <option key={t.trainId} value={t.trainId}>
                  {t.trainNumber} - {t.trainName}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">
                Stop Station *
              </label>
              <select
                value={formData.stationId}
                onChange={(e) => setFormData({ ...formData, stationId: Number(e.target.value) })}
                className="form-input"
              >
                {stations.map((s) => (
                  <option key={s.stationId} value={s.stationId}>
                    {s.stationCode} - {s.stationName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">
                Stop Sequence (1-indexed) *
              </label>
              <input
                type="number"
                min={1}
                required
                value={formData.stopSequence}
                onChange={(e) => setFormData({ ...formData, stopSequence: Number(e.target.value) })}
                className="form-input mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">
                Arrival Time (HH:mm) *
              </label>
              <input
                type="text"
                required
                pattern="[0-9]{2}:[0-9]{2}"
                value={formData.arrivalTime}
                onChange={(e) => setFormData({ ...formData, arrivalTime: e.target.value })}
                className="form-input mono"
                placeholder="14:30"
              />
            </div>
            <div>
              <label className="form-label">
                Departure Time (HH:mm) *
              </label>
              <input
                type="text"
                required
                pattern="[0-9]{2}:[0-9]{2}"
                value={formData.departureTime}
                onChange={(e) => setFormData({ ...formData, departureTime: e.target.value })}
                className="form-input mono"
                placeholder="14:35"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">
                Distance From Origin (km) *
              </label>
              <input
                type="number"
                min={0}
                required
                value={formData.distanceFromOrigin}
                onChange={(e) => setFormData({ ...formData, distanceFromOrigin: Number(e.target.value) })}
                className="form-input mono"
              />
            </div>
            <div>
              <label className="form-label">
                Platform Number *
              </label>
              <input
                type="number"
                min={1}
                required
                value={formData.platformNumber}
                onChange={(e) => setFormData({ ...formData, platformNumber: Number(e.target.value) })}
                className="form-input mono"
              />
            </div>
          </div>

          <div className="form-section-divider flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="btn-ghost"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-secondary"
            >
              {isSubmitting ? 'Saving...' : editingStop ? 'Update Stop' : 'Add Stop'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deletingStop}
        title="Remove Route Stop"
        message={`Are you sure you want to delete stop sequence #${deletingStop?.stopSequence} for Train ${deletingStop?.trainId}?`}
        confirmLabel="Delete Stop"
        isDestructive={true}
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeletingStop(null)}
      />
    </div>
  );
};
