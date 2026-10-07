import React, { useEffect, useState } from 'react';
import { Eye } from 'lucide-react';
import { auditLogService } from '../../services/auditLogService';
import { AuditLog } from '../../types/auditLog';
import { DataTable, Column } from '../../components/DataTable';
import { Modal } from '../../components/Modal';
import { PageHeader } from '../../components/PageHeader';
import { formatDateTime } from '../../utils/format';

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [entityFilter, setEntityFilter] = useState('ALL');
  const [actionFilter, setActionFilter] = useState('ALL');

  // Diff Modal State
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await auditLogService.getAuditLogs({
        entityType: entityFilter !== 'ALL' ? entityFilter : undefined,
        action: actionFilter !== 'ALL' ? actionFilter : undefined,
      });
      setLogs(data);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [entityFilter, actionFilter]);

  const columns: Column<AuditLog>[] = [
    {
      header: 'Audit ID',
      accessorKey: 'auditId',
      sortable: true,
      cell: (row) => <span className="font-mono font-bold text-slate-900">#{row.auditId}</span>,
    },
    {
      header: 'Timestamp (ISO)',
      accessorKey: 'createdAt',
      sortable: true,
      cell: (row) => <span className="font-mono text-xs text-slate-600">{formatDateTime(row.createdAt)}</span>,
    },
    {
      header: 'Admin Actor',
      accessorKey: 'userId',
      sortable: true,
      cell: (row) => (
        <span className="font-semibold text-xs text-slate-800">
          Admin #{row.userId}
        </span>
      ),
    },
    {
      header: 'Action Verb',
      accessorKey: 'action',
      sortable: true,
      cell: (row) => (
        <span className="font-mono font-bold text-xs bg-slate-100 text-slate-800 px-2 py-0.5 rounded">
          {row.action}
        </span>
      ),
    },
    {
      header: 'Target Entity',
      accessorKey: 'entityType',
      sortable: true,
      cell: (row) => (
        <span className="text-xs font-semibold text-slate-700">
          {row.entityType} #{row.entityId}
        </span>
      ),
    },
    {
      header: 'State Inspection',
      align: 'right',
      cell: (row) => (
        <button
          onClick={() => setSelectedLog(row)}
          className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors flex items-center gap-1 ml-auto"
        >
          <Eye className="w-3.5 h-3.5 text-slate-500" />
          <span>Inspect Diff</span>
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Forensic Audit Trail & System Activity"
        description="Immutable forensic log of all administrative modifications with side-by-side state difference tracking."
      />

      {/* Filter Bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-700 focus:ring-2 focus:ring-orange-500 focus:outline-none"
        >
          <option value="ALL">All Entity Types</option>
          <option value="USER">USER</option>
          <option value="STAFF">STAFF</option>
          <option value="TRAIN">TRAIN</option>
          <option value="SCHEDULE">SCHEDULE</option>
          <option value="BOOKING">BOOKING</option>
          <option value="TDR">TDR</option>
          <option value="FARE">FARE</option>
        </select>

        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-700 focus:ring-2 focus:ring-orange-500 focus:outline-none"
        >
          <option value="ALL">All Action Verbs</option>
          <option value="CREATE">CREATE</option>
          <option value="UPDATE">UPDATE</option>
          <option value="DELETE">DELETE</option>
          <option value="OVERRIDE">OVERRIDE</option>
          <option value="SUSPEND_USER">SUSPEND_USER</option>
          <option value="APPROVE_TDR">APPROVE_TDR</option>
        </select>
      </div>

      <DataTable
        data={logs}
        columns={columns}
        loading={loading}
        searchPlaceholder="Search audit events by action, entity, actor..."
        emptyMessage="No audit log events found."
      />

      {/* Side-by-Side Before/After JSON Diff Modal */}
      <Modal
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title={`Audit Event #${selectedLog?.auditId}: ${selectedLog?.action} on ${selectedLog?.entityType} #${selectedLog?.entityId}`}
        maxWidth="xl"
      >
        {selectedLog && (
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs grid grid-cols-2 gap-3">
              <div>
                <span className="text-slate-400 block uppercase">Actor</span>
                <span className="font-bold text-slate-900">Admin #{selectedLog.userId}</span>
              </div>
              <div>
                <span className="text-slate-400 block uppercase">Timestamp</span>
                <span className="font-mono text-slate-900">{formatDateTime(selectedLog.createdAt)}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-bold uppercase text-slate-500 mb-2 flex items-center justify-between">
                  <span>State Before Modification</span>
                  <span className="font-mono text-[10px] text-slate-400">oldValue</span>
                </h4>
                <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg text-xs font-mono overflow-x-auto max-h-64 border border-slate-800">
                  {selectedLog.oldValue
                    ? JSON.stringify(selectedLog.oldValue, null, 2)
                    : '// null (New Record Created)'}
                </pre>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase text-slate-500 mb-2 flex items-center justify-between">
                  <span>State After Modification</span>
                  <span className="font-mono text-[10px] text-orange-600 font-bold">newValue</span>
                </h4>
                <pre className="p-3 bg-slate-900 text-emerald-400 rounded-lg text-xs font-mono overflow-x-auto max-h-64 border border-slate-800">
                  {selectedLog.newValue
                    ? JSON.stringify(selectedLog.newValue, null, 2)
                    : '// null (Record Deleted)'}
                </pre>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
              >
                Close Inspector
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
