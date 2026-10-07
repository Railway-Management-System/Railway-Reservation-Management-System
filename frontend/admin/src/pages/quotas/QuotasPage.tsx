import React, { useEffect, useState } from 'react';
import { Edit2 } from 'lucide-react';
import { quotaService } from '../../services/quotaService';
import { QuotaRule } from '../../types/quota';
import { DataTable, Column } from '../../components/DataTable';
import { Modal } from '../../components/Modal';
import { PageHeader } from '../../components/PageHeader';

export const QuotasPage: React.FC = () => {
  const [quotas, setQuotas] = useState<QuotaRule[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit Modal State
  const [editingQuota, setEditingQuota] = useState<QuotaRule | null>(null);
  const [allocatedPercentage, setAllocatedPercentage] = useState<number>(0);
  const [description, setDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await quotaService.getQuotas();
      setQuotas(data);
    } catch (err) {
      console.error('Failed to load quotas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenEdit = (q: QuotaRule) => {
    setEditingQuota(q);
    setAllocatedPercentage(q.allocatedPercentage);
    setDescription(q.description);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuota) return;
    setIsSubmitting(true);
    try {
      await quotaService.updateQuota(editingQuota.quotaRuleId, {
        allocatedPercentage,
        description,
      });
      await loadData();
      setEditingQuota(null);
    } catch (err: any) {
      alert(err.message || 'Failed to update quota rule.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalPercentage = quotas.reduce((sum, q) => sum + q.allocatedPercentage, 0);

  const columns: Column<QuotaRule>[] = [
    {
      header: 'Quota Classification',
      accessorKey: 'quota',
      sortable: true,
      cell: (row) => (
        <span className="font-mono font-bold text-slate-900 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded text-xs">
          {row.quota}
        </span>
      ),
    },
    {
      header: 'Rake Capacity Share',
      accessorKey: 'allocatedPercentage',
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-2">
          <div className="w-20 bg-slate-100 h-2 rounded-full overflow-hidden">
            <div
              className="bg-orange-600 h-full rounded-full"
              style={{ width: `${Math.min(row.allocatedPercentage, 100)}%` }}
            ></div>
          </div>
          <span className="font-mono text-xs font-bold text-slate-800">{row.allocatedPercentage}%</span>
        </div>
      ),
    },
    {
      header: 'Policy Rule Description',
      accessorKey: 'description',
      cell: (row) => <span className="text-xs text-slate-600">{row.description}</span>,
    },
    {
      header: 'Actions',
      align: 'right',
      cell: (row) => (
        <button
          onClick={() => handleOpenEdit(row)}
          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
          title="Edit Quota Percentage"
        >
          <Edit2 className="w-4 h-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quota Capacity Allocation Rules"
        description="Quota partitions (General, Tatkal, Ladies, Senior Citizen, Divyaang) governing coach inventory availability."
      />

      {/* Quota Total Distribution Summary */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Total Configured Quota Pool</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Sum of all passenger quotas must balance across available coach capacity.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-600">Total Allocation:</span>
          <span
            className={`font-mono text-lg font-bold px-3 py-1 rounded-lg ${
              totalPercentage === 100
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}
          >
            {totalPercentage}%
          </span>
        </div>
      </div>

      <DataTable
        data={quotas}
        columns={columns}
        loading={loading}
        searchPlaceholder="Search quotas..."
        emptyMessage="No quota rules configured."
      />

      {/* Edit Quota Modal */}
      <Modal
        isOpen={!!editingQuota}
        onClose={() => setEditingQuota(null)}
        title={`Edit Quota Allocation - ${editingQuota?.quota}`}
        maxWidth="md"
      >
        {editingQuota && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                Allocated Percentage (%) *
              </label>
              <input
                type="number"
                min={0}
                max={100}
                required
                value={allocatedPercentage}
                onChange={(e) => setAllocatedPercentage(Number(e.target.value))}
                className="w-full text-sm border border-slate-300 rounded-lg p-2.5 font-mono focus:ring-2 focus:ring-orange-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                Policy Description *
              </label>
              <textarea
                required
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-orange-500 focus:outline-none"
              />
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingQuota(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-lg shadow-xs disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Update Quota'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
