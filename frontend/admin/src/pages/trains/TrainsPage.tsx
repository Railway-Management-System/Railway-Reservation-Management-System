import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { trainService } from '../../services/trainService';
import { stationService } from '../../services/stationService';
import { Train, TrainDetail } from '../../types/train';
import { Station } from '../../types/station';
import { TrainType, TrainStatus } from '../../constants/enums';
import { DataTable, Column } from '../../components/DataTable';
import { StatusBadge } from '../../components/StatusBadge';
import { Modal } from '../../components/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PageHeader } from '../../components/PageHeader';
import { ADMIN_ROUTES } from '../../constants/routes';

const ALL_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

export const TrainsPage: React.FC = () => {
  const navigate = useNavigate();
  const [trains, setTrains] = useState<Train[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);

  // Train Details modal
  const [selectedTrainDetail, setSelectedTrainDetail] = useState<TrainDetail | null>(null);

  // Create / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTrain, setEditingTrain] = useState<Train | null>(null);
  const [formData, setFormData] = useState<{
    trainNumber: string;
    trainName: string;
    trainType: TrainType;
    sourceStationId: number;
    destinationStationId: number;
    runningDays: string[];
    status: TrainStatus;
  }>({
    trainNumber: '',
    trainName: '',
    trainType: 'EXPRESS',
    sourceStationId: 1,
    destinationStationId: 7,
    runningDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
    status: 'ACTIVE',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete State
  const [deletingTrain, setDeletingTrain] = useState<Train | null>(null);
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
    } catch (err) {
      console.error('Failed to load trains data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const stationMap = new Map(stations.map((s) => [s.stationId, s]));

  const handleOpenCreate = () => {
    setEditingTrain(null);
    setFormData({
      trainNumber: '',
      trainName: '',
      trainType: 'EXPRESS',
      sourceStationId: stations[0]?.stationId || 1,
      destinationStationId: stations[1]?.stationId || 7,
      runningDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
      status: 'ACTIVE',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (train: Train) => {
    setEditingTrain(train);
    setFormData({
      trainNumber: train.trainNumber,
      trainName: train.trainName,
      trainType: train.trainType,
      sourceStationId: train.sourceStationId,
      destinationStationId: train.destinationStationId,
      runningDays: [...train.runningDays],
      status: train.status,
    });
    setIsModalOpen(true);
  };

  const handleViewDetails = async (trainId: number) => {
    try {
      const detail = await trainService.getTrainById(trainId);
      setSelectedTrainDetail(detail);
    } catch (err: any) {
      alert(err.message || 'Failed to load train details.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.sourceStationId === formData.destinationStationId) {
      alert('Source and Destination stations cannot be identical.');
      return;
    }
    if (formData.runningDays.length === 0) {
      alert('Select at least one running day.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingTrain) {
        await trainService.updateTrain(editingTrain.trainId, formData);
      } else {
        await trainService.createTrain(formData);
      }
      await loadData();
      setIsModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to save train configuration.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingTrain) return;
    setIsDeleting(true);
    try {
      await trainService.deleteTrain(deletingTrain.trainId);
      await loadData();
      setDeletingTrain(null);
    } catch (err: any) {
      alert(err.message || 'Failed to delete train.');
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleDay = (day: string) => {
    setFormData((prev) => {
      const exists = prev.runningDays.includes(day);
      return {
        ...prev,
        runningDays: exists
          ? prev.runningDays.filter((d) => d !== day)
          : [...prev.runningDays, day],
      };
    });
  };

  const columns: Column<Train>[] = [
    {
      header: 'Train Number',
      accessorKey: 'trainNumber',
      sortable: true,
      cell: (row) => (
        <span className="font-mono font-bold text-slate-900 bg-orange-50 text-orange-800 px-2.5 py-1 rounded-md text-xs border border-orange-200">
          {row.trainNumber}
        </span>
      ),
    },
    {
      header: 'Train Name',
      accessorKey: 'trainName',
      sortable: true,
      cell: (row) => (
        <div>
          <div className="font-semibold text-slate-900">{row.trainName}</div>
          <div className="text-xs text-slate-400 font-mono">ID: #{row.trainId}</div>
        </div>
      ),
    },
    {
      header: 'Train Type',
      accessorKey: 'trainType',
      sortable: true,
      cell: (row) => (
        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
          {row.trainType}
        </span>
      ),
    },
    {
      header: 'Route Segment',
      cell: (row) => {
        const src = stationMap.get(row.sourceStationId);
        const dst = stationMap.get(row.destinationStationId);
        return (
          <div className="text-xs font-medium text-slate-700">
            <span className="font-bold text-slate-900">{src?.stationCode || 'SRC'}</span>
            <span className="text-slate-400 mx-1.5">→</span>
            <span className="font-bold text-slate-900">{dst?.stationCode || 'DST'}</span>
            <div className="text-[11px] text-slate-400">
              {src?.city} to {dst?.city}
            </div>
          </div>
        );
      },
    },
    {
      header: 'Running Days',
      cell: (row) => (
        <div className="flex items-center gap-1 flex-wrap max-w-xs">
          {ALL_DAYS.map((day) => {
            const active = row.runningDays.includes(day);
            return (
              <span
                key={day}
                className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                  active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-400'
                }`}
              >
                {day[0]}
              </span>
            );
          })}
        </div>
      ),
    },
    {
      header: 'Status',
      accessorKey: 'status',
      sortable: true,
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      header: 'Actions',
      align: 'right',
      cell: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => handleViewDetails(row.trainId)}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
            title="View Route & Timetable"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleOpenEdit(row)}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
            title="Edit Train"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setDeletingTrain(row)}
            className="p-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-600 transition-colors"
            title="Delete Train"
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
        title="Train Master Fleet Management"
        description="Configure train numbers, nomenclature, coach rakes, running schedules, and station pairs."
        actions={
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Train</span>
          </button>
        }
      />

      <DataTable
        data={trains}
        columns={columns}
        loading={loading}
        searchPlaceholder="Search trains by number, name, type..."
        emptyMessage="No trains found in fleet database."
      />

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingTrain ? `Edit Train #${editingTrain.trainNumber}` : 'Create New Train Service'}
        maxWidth="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                Train Number (5 digits) *
              </label>
              <input
                type="text"
                required
                maxLength={5}
                pattern="[0-9]{5}"
                value={formData.trainNumber}
                onChange={(e) => setFormData({ ...formData, trainNumber: e.target.value })}
                className="w-full text-sm border border-slate-300 rounded-lg p-2.5 font-mono focus:ring-2 focus:ring-orange-500 focus:outline-none"
                placeholder="e.g. 12951"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                Train Type *
              </label>
              <select
                value={formData.trainType}
                onChange={(e) => setFormData({ ...formData, trainType: e.target.value as TrainType })}
                className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-orange-500 focus:outline-none"
              >
                <option value="RAJDHANI">RAJDHANI</option>
                <option value="SHATABDI">SHATABDI</option>
                <option value="VANDE_BHARAT">VANDE_BHARAT</option>
                <option value="EXPRESS">EXPRESS</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
              Train Name *
            </label>
            <input
              type="text"
              required
              value={formData.trainName}
              onChange={(e) => setFormData({ ...formData, trainName: e.target.value })}
              className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-orange-500 focus:outline-none"
              placeholder="e.g. Mumbai Tejas Rajdhani Express"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                Source Station *
              </label>
              <select
                value={formData.sourceStationId}
                onChange={(e) => setFormData({ ...formData, sourceStationId: Number(e.target.value) })}
                className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-orange-500 focus:outline-none"
              >
                {stations.map((s) => (
                  <option key={s.stationId} value={s.stationId}>
                    {s.stationCode} - {s.stationName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                Destination Station *
              </label>
              <select
                value={formData.destinationStationId}
                onChange={(e) => setFormData({ ...formData, destinationStationId: Number(e.target.value) })}
                className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-orange-500 focus:outline-none"
              >
                {stations.map((s) => (
                  <option key={s.stationId} value={s.stationId}>
                    {s.stationCode} - {s.stationName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-2">
              Operational Running Days *
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {ALL_DAYS.map((day) => {
                const isSelected = formData.runningDays.includes(day);
                return (
                  <button
                    type="button"
                    key={day}
                    onClick={() => toggleDay(day)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                      isSelected
                        ? 'bg-orange-600 text-white border-orange-600 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
              Operational Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as TrainStatus })}
              className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-orange-500 focus:outline-none"
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="CANCELLED">CANCELLED</option>
              <option value="RESCHEDULED">RESCHEDULED</option>
              <option value="DIVERTED">DIVERTED</option>
            </select>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-lg shadow-xs disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : editingTrain ? 'Update Train' : 'Create Train'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Train Details & Timetable Modal */}
      <Modal
        isOpen={!!selectedTrainDetail}
        onClose={() => setSelectedTrainDetail(null)}
        title={selectedTrainDetail ? `${selectedTrainDetail.trainNumber} - ${selectedTrainDetail.trainName}` : 'Train Route'}
        maxWidth="xl"
      >
        {selectedTrainDetail && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs font-mono font-bold bg-slate-100 px-2.5 py-1 rounded text-slate-800">
                Type: {selectedTrainDetail.trainType}
              </span>
              <StatusBadge status={selectedTrainDetail.status} size="md" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Ordered Route Stops ({selectedTrainDetail.route.length})
                </h4>
                <button
                  type="button"
                  onClick={() => {
                    const tId = selectedTrainDetail.trainId;
                    setSelectedTrainDetail(null);
                    navigate(`${ADMIN_ROUTES.ROUTES}?trainId=${tId}`);
                  }}
                  className="text-xs text-orange-600 hover:underline font-semibold"
                >
                  Edit Route Stops in Route Editor →
                </button>
              </div>

              {selectedTrainDetail.route.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-lg">
                  No stop sequences configured for this train yet.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-500 font-semibold uppercase border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">Seq</th>
                        <th className="p-2.5">Station</th>
                        <th className="p-2.5">Arr</th>
                        <th className="p-2.5">Dep</th>
                        <th className="p-2.5">Distance</th>
                        <th className="p-2.5">Platform</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {selectedTrainDetail.route.map((r) => (
                        <tr key={r.routeId} className="hover:bg-slate-50/70">
                          <td className="p-2.5 font-bold text-slate-900">{r.stopSequence}</td>
                          <td className="p-2.5 font-sans font-medium text-slate-800">
                            {r.stationCode} ({r.stationName})
                          </td>
                          <td className="p-2.5 text-slate-600">{r.arrivalTime}</td>
                          <td className="p-2.5 text-slate-600">{r.departureTime}</td>
                          <td className="p-2.5 text-slate-600">{r.distanceFromOrigin} km</td>
                          <td className="p-2.5 font-bold text-orange-700">PF #{r.platformNumber}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedTrainDetail(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deletingTrain}
        title="Delete Train Service"
        message={`Are you sure you want to permanently delete Train ${deletingTrain?.trainNumber} (${deletingTrain?.trainName})? This action cannot be reversed if there are dependent reservations.`}
        confirmLabel="Delete Train"
        isDestructive={true}
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeletingTrain(null)}
      />
    </div>
  );
};
