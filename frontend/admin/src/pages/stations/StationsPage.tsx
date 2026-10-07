import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Layers } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { stationService } from '../../services/stationService';
import { platformService } from '../../services/platformService';
import { Station, Platform } from '../../types/station';
import { DataTable, Column } from '../../components/DataTable';
import { Modal } from '../../components/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PageHeader } from '../../components/PageHeader';
import { ADMIN_ROUTES } from '../../constants/routes';

export const StationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [stations, setStations] = useState<Station[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);

  // Create / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStation, setEditingStation] = useState<Station | null>(null);
  const [formData, setFormData] = useState<Omit<Station, 'stationId'>>({
    stationCode: '',
    stationName: '',
    city: '',
    state: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete State
  const [deletingStation, setDeletingStation] = useState<Station | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sList, pList] = await Promise.all([
        stationService.getStations(),
        platformService.getPlatforms(),
      ]);
      setStations(sList);
      setPlatforms(pList);
    } catch (err) {
      console.error('Failed to load stations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const platformCountMap = new Map<number, number>();
  platforms.forEach((p) => {
    platformCountMap.set(p.stationId, (platformCountMap.get(p.stationId) || 0) + 1);
  });

  const handleOpenCreate = () => {
    setEditingStation(null);
    setFormData({
      stationCode: '',
      stationName: '',
      city: '',
      state: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (station: Station) => {
    setEditingStation(station);
    setFormData({
      stationCode: station.stationCode,
      stationName: station.stationName,
      city: station.city,
      state: station.state,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingStation) {
        await stationService.updateStation(editingStation.stationId, formData);
      } else {
        await stationService.createStation(formData);
      }
      await loadData();
      setIsModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to save station record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingStation) return;
    setIsDeleting(true);
    try {
      await stationService.deleteStation(deletingStation.stationId);
      await loadData();
      setDeletingStation(null);
    } catch (err: any) {
      alert(err.message || 'Failed to delete station.');
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: Column<Station>[] = [
    {
      header: 'Station Code',
      accessorKey: 'stationCode',
      sortable: true,
      cell: (row) => (
        <span className="font-mono font-bold text-orange-700 bg-orange-50 px-2.5 py-1 rounded text-xs border border-orange-200">
          {row.stationCode}
        </span>
      ),
    },
    {
      header: 'Station Name',
      accessorKey: 'stationName',
      sortable: true,
      cell: (row) => (
        <div>
          <div className="font-semibold text-slate-900">{row.stationName}</div>
          <div className="text-xs text-slate-400 font-mono">ID: #{row.stationId}</div>
        </div>
      ),
    },
    {
      header: 'City & State',
      cell: (row) => (
        <div className="text-xs text-slate-700">
          <span className="font-medium text-slate-900">{row.city}</span>, {row.state}
        </div>
      ),
    },
    {
      header: 'Configured Platforms',
      cell: (row) => {
        const count = platformCountMap.get(row.stationId) || 0;
        return (
          <button
            onClick={() => navigate(`${ADMIN_ROUTES.PLATFORMS}?stationId=${row.stationId}`)}
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-orange-50 hover:text-orange-700 transition-colors"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{count} Platforms</span>
          </button>
        );
      },
    },
    {
      header: 'Actions',
      align: 'right',
      cell: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => handleOpenEdit(row)}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
            title="Edit Station"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setDeletingStation(row)}
            className="p-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-600 transition-colors"
            title="Delete Station"
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
        title="Railway Stations Master"
        description="Configure station codes, junctions, geographical territories, and track infrastructure."
        actions={
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Station</span>
          </button>
        }
      />

      <DataTable
        data={stations}
        columns={columns}
        loading={loading}
        searchPlaceholder="Search stations by code, name, city, state..."
        emptyMessage="No railway stations found."
      />

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingStation ? `Edit Station ${editingStation.stationCode}` : 'Create New Railway Station'}
        maxWidth="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                Station Code (3-4 Chars) *
              </label>
              <input
                type="text"
                required
                maxLength={4}
                value={formData.stationCode}
                onChange={(e) => setFormData({ ...formData, stationCode: e.target.value.toUpperCase() })}
                className="w-full text-sm border border-slate-300 rounded-lg p-2.5 font-mono uppercase focus:ring-2 focus:ring-orange-500 focus:outline-none"
                placeholder="e.g. NDLS"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                City *
              </label>
              <input
                type="text"
                required
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                placeholder="e.g. New Delhi"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
              Complete Station Name *
            </label>
            <input
              type="text"
              required
              value={formData.stationName}
              onChange={(e) => setFormData({ ...formData, stationName: e.target.value })}
              className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-orange-500 focus:outline-none"
              placeholder="e.g. New Delhi Railway Station"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
              State / Territory *
            </label>
            <input
              type="text"
              required
              value={formData.state}
              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-orange-500 focus:outline-none"
              placeholder="e.g. Delhi"
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
              {isSubmitting ? 'Saving...' : editingStation ? 'Update Station' : 'Create Station'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deletingStation}
        title="Delete Railway Station"
        message={`Are you sure you want to delete station ${deletingStation?.stationCode} (${deletingStation?.stationName})? Deletion will be rejected if referenced in active train routes.`}
        confirmLabel="Delete Station"
        isDestructive={true}
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeletingStation(null)}
      />
    </div>
  );
};
