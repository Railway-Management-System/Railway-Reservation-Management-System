import React, { useEffect, useState } from 'react';
import { incidentService } from '../../services/incidentService';

import { Incident } from '../../types/incident';
import { IncidentStatus } from '../../constants/enums';
import { DataTable, Column } from '../../components/DataTable';
import { StatusBadge } from '../../components/StatusBadge';
import { Modal } from '../../components/Modal';
import { PageHeader } from '../../components/PageHeader';

export const IncidentsPage: React.FC = () => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
    const [loading, setLoading] = useState(true);

  // Status Update Modal
  const [updatingIncident, setUpdatingIncident] = useState<Incident | null>(null);
  const [statusSelection, setStatusSelection] = useState<IncidentStatus>('RESOLVED');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadIncidents = async () => {
    setLoading(true);
    try {
      const [iList] = await Promise.all([
        incidentService.getIncidents(),
        
      ]);
      setIncidents(iList);
          } catch (err) {
      console.error('Failed to load incidents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIncidents();
  }, []);

  
  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updatingIncident) return;
    setIsSubmitting(true);
    try {
      await incidentService.updateIncidentStatus(updatingIncident.incidentId, statusSelection);
      await loadIncidents();
      setUpdatingIncident(null);
    } catch (err: any) {
      alert(err.message || 'Failed to update incident status.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: Column<Incident>[] = [
    {
      header: 'Incident ID',
      accessorKey: 'incidentId',
      sortable: true,
      cell: (row) => <span className="font-mono font-bold text-slate-900">#{row.incidentId}</span>,
    },
    {
      header: 'Emergency Classification',
      accessorKey: 'type',
      sortable: true,
      cell: (row) => (
        <span className="font-semibold text-slate-900 text-xs">
          {row.type.replace(/_/g, ' ')}
        </span>
      ),
    },
    {
      header: 'Severity',
      accessorKey: 'severity',
      sortable: true,
      cell: (row) => <StatusBadge status={row.severity} />,
    },
    {
      header: 'Location',
      cell: (row) => (
        <div className="text-xs text-slate-700">
          <span className="font-semibold">{row.locationType}</span>
          {row.trainId ? ` (Train #${row.trainId})` : row.stationId ? ` (Station #${row.stationId})` : ''}
        </div>
      ),
    },
    {
      header: 'Description Notes',
      accessorKey: 'description',
      cell: (row) => <p className="text-xs text-slate-600 line-clamp-2 max-w-sm">{row.description}</p>,
    },
    {
      header: 'Operational State',
      accessorKey: 'status',
      sortable: true,
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      header: 'Actions',
      align: 'right',
      cell: () => (
        <button
          onClick={() => {}}
          className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors"
        >
          Update State
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Safety & Operational Incident Escalations"
        description="Monitor critical medical emergencies, technical failures, and security alerts logged across trains and stations."
        contractGapProposedEndpoint="GET /api/admin/incidents"
      />

      <DataTable
        data={incidents}
        columns={columns}
        loading={loading}
        searchPlaceholder="Search incidents by type, severity, location..."
        emptyMessage="No emergency incidents logged."
      />

      {/* Update Incident Status Modal */}
      <Modal
        isOpen={!!updatingIncident}
        onClose={() => setUpdatingIncident(null)}
        title={`Update Incident #${updatingIncident?.incidentId} State`}
        maxWidth="md"
      >
        {updatingIncident && (
          <form onSubmit={handleStatusSubmit} className="space-y-4">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
              <div className="font-bold text-slate-800">
                Type: {updatingIncident.type} (Severity: {updatingIncident.severity})
              </div>
              <p className="text-slate-600">{updatingIncident.description}</p>
            </div>

            <div>
              <label className="form-label">
                Set Operational State *
              </label>
              <select
                value={statusSelection}
                onChange={(e) => setStatusSelection(e.target.value as IncidentStatus)}
                className="form-input"
              >
                <option value="REPORTED">REPORTED (New alert)</option>
                <option value="ACKNOWLEDGED">ACKNOWLEDGED (Team dispatched)</option>
                <option value="RESOLVED">RESOLVED (Cleared)</option>
              </select>
            </div>

            <div className="form-section-divider flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setUpdatingIncident(null)}
                className="btn-ghost"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-secondary"
              >
                {isSubmitting ? 'Saving...' : 'Save State'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
