import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { API_CONFIG } from '../../config/api.config';
import { platformService } from '../../services/platformService';
import { stationService } from '../../services/stationService';
import { Platform, Station } from '../../types/station';
import { DataTable, Column } from '../../components/DataTable';
import { StatusBadge } from '../../components/StatusBadge';
import { Modal } from '../../components/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PageHeader } from '../../components/PageHeader';

export const PlatformsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const stationIdParam = searchParams.get('stationId');

  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedStationId, setSelectedStationId] = useState<string>(stationIdParam || 'ALL');
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlatform, setEditingPlatform] = useState<Platform | null>(null);
  const [formData, setFormData] = useState<Omit<Platform, 'platformId'>>({
    stationId: 1,
    platformNumber: 1,
    status: 'ACTIVE',
    facilities: ['Waiting Hall', 'Water Dispenser'],
  });
  const [facilitiesInput, setFacilitiesInput] = useState('Waiting Hall, Water Dispenser');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete State
  const [deletingPlatform, setDeletingPlatform] = useState<Platform | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const sId = selectedStationId !== 'ALL' ? Number(selectedStationId) : undefined;
      const [pList, sList] = await Promise.all([
        platformService.getPlatforms(sId),
        stationService.getStations(),
      ]);
      setPlatforms(pList);
      setStations(sList);
    } catch (err: any) {
      console.error('Failed to load platforms:', err);
      setError(err?.message || 'Failed to load platform data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedStationId]);

  const stationMap = new Map(stations.map((s) => [s.stationId, s]));

  const handleStationFilterChange = (val: string) => {
    setSelectedStationId(val);
    if (val === 'ALL') {
      searchParams.delete('stationId');
      setSearchParams(searchParams);
    } else {
      setSearchParams({ stationId: val });
    }
  };

  const handleOpenCreate = () => {
    setEditingPlatform(null);
    const defaultStation = selectedStationId !== 'ALL' ? Number(selectedStationId) : stations[0]?.stationId || 1;
    const existingPfs = platforms.filter((p) => p.stationId === defaultStation);
    const nextPfNum = existingPfs.length > 0 ? Math.max(...existingPfs.map((p) => p.platformNumber)) + 1 : 1;

    setFormData({
      stationId: defaultStation,
      platformNumber: nextPfNum,
      status: 'ACTIVE',
      facilities: ['Waiting Hall', 'Water Dispenser', 'Digital Coach Indicator'],
    });
    setFacilitiesInput('Waiting Hall, Water Dispenser, Digital Coach Indicator');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: Platform) => {
    setEditingPlatform(p);
    setFormData({
      stationId: p.stationId,
      platformNumber: p.platformNumber,
      status: p.status,
      facilities: [...p.facilities],
    });
    setFacilitiesInput(p.facilities.join(', '));
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const parsedFacilities = facilitiesInput
        .split(',')
        .map((f) => f.trim())
        .filter(Boolean);

      const payload = {
        ...formData,
        facilities: parsedFacilities,
      };

      if (editingPlatform) {
        await platformService.updatePlatform(editingPlatform.platformId, payload);
      } else {
        await platformService.createPlatform(payload);
      }
      await loadData();
      setIsModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to save platform.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingPlatform) return;
    setIsDeleting(true);
    try {
      await platformService.deletePlatform(deletingPlatform.platformId);
      await loadData();
      setDeletingPlatform(null);
    } catch (err: any) {
      alert(err.message || 'Failed to delete platform.');
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: Column<Platform>[] = [
    {
      header: 'Platform',
      accessorKey: 'platformNumber',
      sortable: true,
      cell: (row) => (
        <span className="font-mono font-bold text-orange-800 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded text-xs">
          PF #{row.platformNumber}
        </span>
      ),
    },
    {
      header: 'Station',
      cell: (row) => {
        const station = stationMap.get(row.stationId);
        return (
          <div>
            <span className="font-bold text-slate-900">{station?.stationCode || row.stationId}</span>
            <div className="text-xs text-slate-500">{station?.stationName}</div>
          </div>
        );
      },
    },
    {
      header: 'Operational Status',
      accessorKey: 'status',
      sortable: true,
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      header: 'Facilities Available',
      cell: (row) => (
        <div className="flex items-center gap-1.5 flex-wrap max-w-sm">
          {row.facilities.map((fac, idx) => (
            <span
              key={idx}
              className="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium"
            >
              {fac}
            </span>
          ))}
        </div>
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
            title="Edit Platform"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setDeletingPlatform(row)}
            className="p-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-600 transition-colors"
            title="Delete Platform"
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
        title="Station Platforms & Track Infrastructure"
        description="Configure station platforms, track availability states (ACTIVE / MAINTENANCE / CLOSED), and passenger amenities."
        actions={
          <div className="flex items-center gap-3">
            <select
              value={selectedStationId}
              onChange={(e) => handleStationFilterChange(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-700 focus:ring-2 focus:ring-orange-500 focus:outline-none"
            >
              <option value="ALL">All Stations</option>
              {stations.map((s) => (
                <option key={s.stationId} value={s.stationId}>
                  {s.stationCode} - {s.stationName}
                </option>
              ))}
            </select>
            {API_CONFIG.USE_MOCK ? (
              <button
                onClick={handleOpenCreate}
                className="btn-secondary"
              >
                <Plus className="w-4 h-4" />
                <span>Add Platform</span>
              </button>
            ) : (
              <button
                disabled
                title="This feature is not available yet."
                className="btn-secondary opacity-50 cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                <span>This feature is not available yet.</span>
              </button>
            )}
          </div>
        }

      />

      <DataTable
        data={platforms}
        columns={columns}
        loading={loading}
        error={error}
        onRetry={loadData}
        searchPlaceholder="Search platforms by number, station, facility..."
        emptyMessage="No platforms found."
      />

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingPlatform ? `Edit Platform #${editingPlatform.platformNumber}` : 'Add Station Platform'}
        maxWidth="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label">
              Station *
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

          <div className="grid grid-cols-2 gap-4">
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
            <div>
              <label className="form-label">
                Operational Status *
              </label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    status: e.target.value as 'ACTIVE' | 'MAINTENANCE' | 'CLOSED',
                  })
                }
                className="form-input"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="MAINTENANCE">MAINTENANCE</option>
                <option value="CLOSED">CLOSED</option>
              </select>
            </div>
          </div>

          <div>
            <label className="form-label">
              Facilities (Comma Separated)
            </label>
            <input
              type="text"
              value={facilitiesInput}
              onChange={(e) => setFacilitiesInput(e.target.value)}
              className="form-input"
              placeholder="Waiting Hall, Water Dispenser, Escalator, Wi-Fi"
            />
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
              {isSubmitting ? 'Saving...' : editingPlatform ? 'Update Platform' : 'Create Platform'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deletingPlatform}
        title="Delete Station Platform"
        message={`Are you sure you want to delete Platform #${deletingPlatform?.platformNumber}?`}
        confirmLabel="Delete Platform"
        isDestructive={true}
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeletingPlatform(null)}
      />
    </div>
  );
};
