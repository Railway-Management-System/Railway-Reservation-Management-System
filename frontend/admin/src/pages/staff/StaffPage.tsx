import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Building2 } from 'lucide-react';
import { staffService } from '../../services/staffService';
import { stationService } from '../../services/stationService';
import { Staff, CreateStaffPayload } from '../../types/staff';
import { Station } from '../../types/station';
import { StaffStatus } from '../../constants/enums';
import { DataTable, Column } from '../../components/DataTable';
import { StatusBadge } from '../../components/StatusBadge';
import { Modal } from '../../components/Modal';
import { PageHeader } from '../../components/PageHeader';

export const StaffPage: React.FC = () => {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);

  // Create Staff Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newStaff, setNewStaff] = useState<CreateStaffPayload>({
    name: '',
    email: '',
    phone: '',
    employeeId: '',
    designation: 'Ticket Collector (TC)',
    assignedStationId: 1,
    status: 'ON_DUTY',
  });
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  // Edit Staff Modal State
  const [editStaff, setEditStaff] = useState<Staff | null>(null);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sList, stList] = await Promise.all([
        staffService.getStaff(),
        stationService.getStations(),
      ]);
      setStaffList(sList);
      setStations(stList);
    } catch (err) {
      console.error('Failed to load staff list:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const stationMap = new Map(stations.map((s) => [s.stationId, s]));

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingCreate(true);
    try {
      await staffService.createStaff(newStaff);
      await loadData();
      setCreateModalOpen(false);
      setNewStaff({
        name: '',
        email: '',
        phone: '',
        employeeId: '',
        designation: 'Ticket Collector (TC)',
        assignedStationId: stations[0]?.stationId || 1,
        status: 'ON_DUTY',
      });
    } catch (err: any) {
      alert(err.message || 'Failed to create staff member.');
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editStaff) return;
    setIsSubmittingEdit(true);
    try {
      await staffService.updateStaff(editStaff.staffId, {
        designation: editStaff.designation,
        assignedStationId: editStaff.assignedStationId,
        status: editStaff.status,
      });
      await loadData();
      setEditStaff(null);
    } catch (err: any) {
      alert(err.message || 'Failed to update staff member.');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const columns: Column<Staff>[] = [
    {
      header: 'Employee Code',
      accessorKey: 'employeeId',
      sortable: true,
      cell: (row) => <span className="font-mono font-bold text-slate-900">{row.employeeId}</span>,
    },
    {
      header: 'Full Name',
      accessorKey: 'name',
      sortable: true,
      cell: (row) => (
        <div>
          <div className="font-semibold text-slate-900">{row.name}</div>
          <div className="text-xs text-slate-500 font-mono">Staff ID: #{row.staffId}</div>
        </div>
      ),
    },
    {
      header: 'Designation',
      accessorKey: 'designation',
      sortable: true,
      cell: (row) => (
        <span className="font-medium text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-xs">
          {row.designation}
        </span>
      ),
    },
    {
      header: 'Assigned Station',
      cell: (row) => {
        const station = row.assignedStationId ? stationMap.get(row.assignedStationId) : null;
        return (
          <div className="flex items-center gap-1.5 text-xs text-slate-700">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            {station ? `${station.stationCode} - ${station.stationName}` : 'Unassigned'}
          </div>
        );
      },
    },
    {
      header: 'Duty Status',
      accessorKey: 'status',
      sortable: true,
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      header: 'Actions',
      align: 'right',
      cell: (row) => (
        <button
          onClick={() => setEditStaff({ ...row })}
          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
          title="Edit Assignment"
        >
          <Edit2 className="w-4 h-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Railway Staff & TC Personnel"
        description="Onboard railway field staff, assign station rosters, and manage operational duties."
        actions={
          <button
            onClick={() => setCreateModalOpen(true)}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Onboard New Staff</span>
          </button>
        }
      />

      <DataTable
        data={staffList}
        columns={columns}
        loading={loading}
        searchPlaceholder="Search staff by employee code, name, designation..."
        emptyMessage="No railway personnel found."
      />

      {/* Onboard New Staff Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Onboard Railway Personnel"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={newStaff.name}
                onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                placeholder="e.g. Ramesh Nair"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                Employee ID Code *
              </label>
              <input
                type="text"
                required
                value={newStaff.employeeId}
                onChange={(e) => setNewStaff({ ...newStaff, employeeId: e.target.value })}
                className="w-full text-sm border border-slate-300 rounded-lg p-2.5 font-mono focus:ring-2 focus:ring-orange-500 focus:outline-none"
                placeholder="e.g. EMP-TC-201"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                Official Email *
              </label>
              <input
                type="email"
                required
                value={newStaff.email}
                onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                placeholder="name@railways.gov.in"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                Mobile Phone *
              </label>
              <input
                type="text"
                required
                value={newStaff.phone}
                onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                className="w-full text-sm border border-slate-300 rounded-lg p-2.5 font-mono focus:ring-2 focus:ring-orange-500 focus:outline-none"
                placeholder="9876543210"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                Designation *
              </label>
              <select
                value={newStaff.designation}
                onChange={(e) => setNewStaff({ ...newStaff, designation: e.target.value })}
                className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-orange-500 focus:outline-none"
              >
                <option value="Ticket Collector (TC)">Ticket Collector (TC)</option>
                <option value="Station Manager">Station Manager</option>
                <option value="Chief Commercial Inspector">Chief Commercial Inspector</option>
                <option value="Platform Duty Officer">Platform Duty Officer</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                Assigned Base Station
              </label>
              <select
                value={newStaff.assignedStationId || ''}
                onChange={(e) =>
                  setNewStaff({
                    ...newStaff,
                    assignedStationId: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-orange-500 focus:outline-none"
              >
                <option value="">Unassigned</option>
                {stations.map((s) => (
                  <option key={s.stationId} value={s.stationId}>
                    {s.stationCode} - {s.stationName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingCreate}
              className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-lg shadow-xs disabled:opacity-50"
            >
              {isSubmittingCreate ? 'Saving...' : 'Register Staff'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Staff Modal */}
      <Modal
        isOpen={!!editStaff}
        onClose={() => setEditStaff(null)}
        title="Update Staff Designation & Duty"
        maxWidth="md"
      >
        {editStaff && (
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                Staff Name & Code
              </label>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-sm font-semibold text-slate-800">
                {editStaff.name} ({editStaff.employeeId})
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                Designation
              </label>
              <select
                value={editStaff.designation}
                onChange={(e) => setEditStaff({ ...editStaff, designation: e.target.value })}
                className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-orange-500 focus:outline-none"
              >
                <option value="Ticket Collector (TC)">Ticket Collector (TC)</option>
                <option value="Station Manager">Station Manager</option>
                <option value="Chief Commercial Inspector">Chief Commercial Inspector</option>
                <option value="Platform Duty Officer">Platform Duty Officer</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                Assigned Station
              </label>
              <select
                value={editStaff.assignedStationId || ''}
                onChange={(e) =>
                  setEditStaff({
                    ...editStaff,
                    assignedStationId: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-orange-500 focus:outline-none"
              >
                <option value="">Unassigned</option>
                {stations.map((s) => (
                  <option key={s.stationId} value={s.stationId}>
                    {s.stationCode} - {s.stationName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                Operational Status
              </label>
              <select
                value={editStaff.status}
                onChange={(e) =>
                  setEditStaff({ ...editStaff, status: e.target.value as StaffStatus })
                }
                className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-orange-500 focus:outline-none"
              >
                <option value="ON_DUTY">ON_DUTY</option>
                <option value="OFF_DUTY">OFF_DUTY</option>
                <option value="ON_LEAVE">ON_LEAVE</option>
              </select>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditStaff(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingEdit}
                className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-lg shadow-xs disabled:opacity-50"
              >
                {isSubmittingEdit ? 'Saving...' : 'Update Staff'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
