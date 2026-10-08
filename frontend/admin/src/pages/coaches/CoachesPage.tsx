import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Plus, Edit2, Trash2, Armchair} from 'lucide-react';
import { coachService } from '../../services/coachService';
import { trainService } from '../../services/trainService';
import { Coach } from '../../types/coach';
import { Train } from '../../types/train';
import { ClassType } from '../../constants/enums';
import { DataTable, Column } from '../../components/DataTable';
import { Modal } from '../../components/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PageHeader } from '../../components/PageHeader';
import { ADMIN_ROUTES } from '../../constants/routes';

export const CoachesPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const trainIdParam = searchParams.get('trainId');

  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [trains, setTrains] = useState<Train[]>([]);
  const [selectedTrainId, setSelectedTrainId] = useState<string>(trainIdParam || 'ALL');
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoach, setEditingCoach] = useState<Coach | null>(null);
  const [formData, setFormData] = useState<Omit<Coach, 'coachId'>>({
    trainId: 101,
    coachNumber: 'B1',
    coachType: 'AC_3_TIER',
    classType: '3A',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete State
  const [deletingCoach, setDeletingCoach] = useState<Coach | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const tId = selectedTrainId !== 'ALL' ? Number(selectedTrainId) : undefined;
      const [cList, tList] = await Promise.all([
        coachService.getCoaches(tId),
        trainService.getTrains(),
      ]);
      setCoaches(cList);
      setTrains(tList);
    } catch (err) {
      console.error('Failed to load coaches:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedTrainId]);

  const trainMap = new Map(trains.map((t) => [t.trainId, t]));

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
    setEditingCoach(null);
    setFormData({
      trainId: selectedTrainId !== 'ALL' ? Number(selectedTrainId) : trains[0]?.trainId || 101,
      coachNumber: 'B3',
      coachType: 'AC_3_TIER',
      classType: '3A',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (coach: Coach) => {
    setEditingCoach(coach);
    setFormData({
      trainId: coach.trainId,
      coachNumber: coach.coachNumber,
      coachType: coach.coachType,
      classType: coach.classType,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingCoach) {
        await coachService.updateCoach(editingCoach.coachId, formData);
      } else {
        await coachService.createCoach(formData);
      }
      await loadData();
      setIsModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to save coach.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingCoach) return;
    setIsDeleting(true);
    try {
      await coachService.deleteCoach(deletingCoach.coachId);
      await loadData();
      setDeletingCoach(null);
    } catch (err: any) {
      alert(err.message || 'Failed to delete coach.');
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: Column<Coach>[] = [
    {
      header: 'Coach Code',
      accessorKey: 'coachNumber',
      sortable: true,
      cell: (row) => (
        <span className="font-mono font-bold text-orange-800 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded text-xs">
          {row.coachNumber}
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
      header: 'Class Type',
      accessorKey: 'classType',
      sortable: true,
      cell: (row) => (
        <span className="font-mono font-bold text-xs bg-slate-100 text-slate-800 px-2 py-0.5 rounded">
          {row.classType}
        </span>
      ),
    },
    {
      header: 'Physical Specification',
      accessorKey: 'coachType',
      sortable: true,
      cell: (row) => <span className="text-xs text-slate-600 font-medium">{row.coachType}</span>,
    },
    {
      header: 'Seat Layout',
      cell: (row) => (
        <button
          onClick={() => navigate(`${ADMIN_ROUTES.SEATS}?coachId=${row.coachId}`)}
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-orange-50 hover:text-orange-700 transition-colors"
        >
          <Armchair className="w-3.5 h-3.5" />
          <span>Berth Layout →</span>
        </button>
      ),
    },
    {
      header: 'Actions',
      align: 'right',
      cell: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => handleOpenEdit(row)}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
            title="Edit Coach"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setDeletingCoach(row)}
            className="p-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-600 transition-colors"
            title="Delete Coach"
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
        title="Train Coaches & Rolling Stock"
        description="Configure rake composition, assigned classes (1A, 2A, 3A, SL, CC, EC, 2S), and physical coach designations."
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
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Attach Coach</span>
            </button>
          </div>
        }
      />

      <DataTable
        data={coaches}
        columns={columns}
        loading={loading}
        searchPlaceholder="Search coaches by coach code, type, class..."
        emptyMessage="No coaches attached."
      />

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCoach ? `Edit Coach ${editingCoach.coachNumber}` : 'Attach Coach to Train Rake'}
        maxWidth="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
              Train Service *
            </label>
            <select
              value={formData.trainId}
              onChange={(e) => setFormData({ ...formData, trainId: Number(e.target.value) })}
              className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-orange-500 focus:outline-none"
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
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                Coach Code (e.g. B1, A1, S1) *
              </label>
              <input
                type="text"
                required
                value={formData.coachNumber}
                onChange={(e) => setFormData({ ...formData, coachNumber: e.target.value.toUpperCase() })}
                className="w-full text-sm border border-slate-300 rounded-lg p-2.5 font-mono uppercase focus:ring-2 focus:ring-orange-500 focus:outline-none"
                placeholder="B1"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                Travel Class *
              </label>
              <select
                value={formData.classType}
                onChange={(e) => setFormData({ ...formData, classType: e.target.value as ClassType })}
                className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-orange-500 focus:outline-none"
              >
                <option value="1A">1A (First AC)</option>
                <option value="2A">2A (AC 2 Tier)</option>
                <option value="3A">3A (AC 3 Tier)</option>
                <option value="SL">SL (Sleeper)</option>
                <option value="CC">CC (AC Chair Car)</option>
                <option value="2S">2S (Second Sitting)</option>
                <option value="EC">EC (Exec Chair Car)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
              Physical Specification *
            </label>
            <input
              type="text"
              required
              value={formData.coachType}
              onChange={(e) => setFormData({ ...formData, coachType: e.target.value })}
              className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-orange-500 focus:outline-none"
              placeholder="e.g. AC_3_TIER, SLEEPER, AC_CHAIR_CAR"
            />
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
              {isSubmitting ? 'Saving...' : editingCoach ? 'Update Coach' : 'Attach Coach'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deletingCoach}
        title="Detach Coach"
        message={`Are you sure you want to delete Coach ${deletingCoach?.coachNumber} from Train ${deletingCoach?.trainId}?`}
        confirmLabel="Detach Coach"
        isDestructive={true}
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeletingCoach(null)}
      />
    </div>
  );
};
