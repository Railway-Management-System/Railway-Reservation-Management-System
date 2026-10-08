import React, { useEffect, useState } from 'react';
import { Edit2, Calculator,  } from 'lucide-react';
import { fareService } from '../../services/fareService';
import { FareRule } from '../../types/fare';
import { ClassType } from '../../constants/enums';
import { DataTable, Column } from '../../components/DataTable';
import { Modal } from '../../components/Modal';
import { PageHeader } from '../../components/PageHeader';
import { calculateFare } from '../../utils/fareCalculator';
import { formatCurrency } from '../../utils/format';

export const FaresPage: React.FC = () => {
  const [fares, setFares] = useState<FareRule[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit Fare Modal
  const [editingFare, setEditingFare] = useState<FareRule | null>(null);
  const [formData, setFormData] = useState<Partial<FareRule>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Interactive Live Fare Calculator Preview Inputs
  const [calcDistance, setCalcDistance] = useState<number>(1384);
  const [calcClass, setCalcClass] = useState<ClassType>('3A');
  const [calcIsTatkal, setCalcIsTatkal] = useState<boolean>(false);
  const [calcInsurance, setCalcInsurance] = useState<boolean>(true);
  const [calcConcession, setCalcConcession] = useState<number>(0);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fareService.getFares();
      setFares(data);
    } catch (err) {
      console.error('Failed to load fares:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenEdit = (fare: FareRule) => {
    setEditingFare(fare);
    setFormData({
      baseRatePerKm: fare.baseRatePerKm,
      reservationCharge: fare.reservationCharge,
      tatkalCharge: fare.tatkalCharge,
      gstPercentage: fare.gstPercentage,
      insurancePremium: fare.insurancePremium,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFare) return;
    setIsSubmitting(true);
    try {
      await fareService.updateFare(editingFare.fareId, formData);
      await loadData();
      setEditingFare(null);
    } catch (err: any) {
      alert(err.message || 'Failed to update fare rule.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Live Calculator Calculation
  const selectedRule = fares.find((f) => f.classType === calcClass);
  const fareResult = calculateFare(
    {
      distanceKm: calcDistance,
      classType: calcClass,
      isTatkal: calcIsTatkal,
      insuranceSelected: calcInsurance,
      concessionDiscount: calcConcession,
    },
    selectedRule
  );

  const columns: Column<FareRule>[] = [
    {
      header: 'Travel Class',
      accessorKey: 'classType',
      sortable: true,
      cell: (row) => (
        <span className="font-mono font-bold text-slate-900 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded text-xs">
          {row.classType}
        </span>
      ),
    },
    {
      header: 'Base Rate / km',
      accessorKey: 'baseRatePerKm',
      sortable: true,
      cell: (row) => <span className="font-mono text-xs font-semibold">₹ {row.baseRatePerKm.toFixed(2)}</span>,
    },
    {
      header: 'Reservation Charge',
      accessorKey: 'reservationCharge',
      cell: (row) => <span className="font-mono text-xs">₹ {row.reservationCharge.toFixed(2)}</span>,
    },
    {
      header: 'Tatkal Surcharge',
      accessorKey: 'tatkalCharge',
      cell: (row) => <span className="font-mono text-xs font-semibold text-amber-700">₹ {row.tatkalCharge.toFixed(2)}</span>,
    },
    {
      header: 'GST Rate',
      accessorKey: 'gstPercentage',
      cell: (row) => (
        <span className="font-mono text-xs font-semibold text-slate-700">
          {row.gstPercentage}% {row.gstPercentage > 0 ? '(AC)' : '(Non-AC)'}
        </span>
      ),
    },
    {
      header: 'Insurance Premium',
      accessorKey: 'insurancePremium',
      cell: (row) => <span className="font-mono text-xs text-slate-500">₹ {row.insurancePremium.toFixed(2)}</span>,
    },
    {
      header: 'Actions',
      align: 'right',
      cell: (row) => (
        <button
          onClick={() => handleOpenEdit(row)}
          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
          title="Edit Fare Rates"
        >
          <Edit2 className="w-4 h-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fare Structure & Live Pricing Calculator"
        description="Distance-based class base rates, reservation fees, Tatkal surcharges, and canonical fare computation engine."
      />

      {/* Live Interactive Fare Calculator Preview Card */}
      <div className="bg-white rounded-2xl border border-orange-200 shadow-sm overflow-hidden">
        <div className="p-5 bg-gradient-to-r from-orange-600 to-amber-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Calculator className="w-6 h-6" />
            <div>
              <h3 className="text-base font-bold">Canonical Fare Calculation Engine (Live Preview)</h3>
              <p className="text-xs text-orange-100">
                Formula: (Distance × Rate) + Resv + Tatkal + Insurance + GST (5% AC) − Concession
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold bg-white/20 px-2.5 py-1 rounded-md">
            REAL-TIME PREVIEW
          </span>
        </div>

        <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Controls (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                  Route Distance (km)
                </label>
                <input
                  type="number"
                  min={1}
                  value={calcDistance}
                  onChange={(e) => setCalcDistance(Number(e.target.value))}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2.5 font-mono focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                  Travel Class
                </label>
                <select
                  value={calcClass}
                  onChange={(e) => setCalcClass(e.target.value as ClassType)}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                >
                  <option value="1A">1A (First AC)</option>
                  <option value="2A">2A (AC 2 Tier)</option>
                  <option value="3A">3A (AC 3 Tier)</option>
                  <option value="SL">SL (Sleeper Class)</option>
                  <option value="CC">CC (AC Chair Car)</option>
                  <option value="2S">2S (Second Sitting)</option>
                  <option value="EC">EC (Exec Chair Car)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <label className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={calcIsTatkal}
                  onChange={(e) => setCalcIsTatkal(e.target.checked)}
                  className="rounded text-orange-600 focus:ring-orange-500 w-4 h-4"
                />
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Tatkal Quota</span>
                  <span className="text-[10px] text-slate-500">+ Surcharge</span>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={calcInsurance}
                  onChange={(e) => setCalcInsurance(e.target.checked)}
                  className="rounded text-orange-600 focus:ring-orange-500 w-4 h-4"
                />
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Travel Insurance</span>
                  <span className="text-[10px] text-slate-500">₹ 0.45 opt-in</span>
                </div>
              </label>

              <div>
                <label className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">
                  Concession Discount (₹)
                </label>
                <input
                  type="number"
                  min={0}
                  value={calcConcession}
                  onChange={(e) => setCalcConcession(Number(e.target.value))}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 font-mono focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          {/* Itemized Fare Breakdown (5 cols) */}
          <div className="lg:col-span-5 bg-slate-50 rounded-xl p-5 border border-slate-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Computed Fare Breakdown
                </span>
                <span className="text-xs font-mono font-semibold text-slate-600">
                  Class {calcClass} ({calcDistance} km)
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Base Fare:</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {formatCurrency(fareResult.baseFare)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Reservation Surcharge:</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {formatCurrency(fareResult.reservationCharge)}
                  </span>
                </div>
                {fareResult.tatkalCharge > 0 && (
                  <div className="flex justify-between text-amber-700 font-semibold">
                    <span>Tatkal Premium:</span>
                    <span className="font-mono">{formatCurrency(fareResult.tatkalCharge)}</span>
                  </div>
                )}
                {fareResult.insurancePremium > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Travel Insurance:</span>
                    <span className="font-mono">{formatCurrency(fareResult.insurancePremium)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-500 border-t border-slate-200/80 pt-1.5 font-medium">
                  <span>Subtotal:</span>
                  <span className="font-mono">{formatCurrency(fareResult.subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Goods & Services Tax (GST 5%):</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {formatCurrency(fareResult.gst)}
                  </span>
                </div>
                {fareResult.concessionDiscount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-semibold">
                    <span>Concession Discount:</span>
                    <span className="font-mono">− {formatCurrency(fareResult.concessionDiscount)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t-2 border-slate-300 flex items-baseline justify-between">
              <span className="text-sm font-bold text-slate-900">Total Ticket Fare</span>
              <span className="text-2xl font-extrabold text-orange-600 font-mono">
                {formatCurrency(fareResult.totalFare)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <DataTable
        data={fares}
        columns={columns}
        loading={loading}
        searchPlaceholder="Search fare classes..."
        emptyMessage="No fare rules found."
      />

      {/* Edit Fare Rates Modal */}
      <Modal
        isOpen={!!editingFare}
        onClose={() => setEditingFare(null)}
        title={`Edit Fare Matrix - Class ${editingFare?.classType}`}
        maxWidth="md"
      >
        {editingFare && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                  Base Rate Per Km (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={0.01}
                  required
                  value={formData.baseRatePerKm || 0}
                  onChange={(e) => setFormData({ ...formData, baseRatePerKm: Number(e.target.value) })}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2.5 font-mono focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                  Reservation Charge (₹) *
                </label>
                <input
                  type="number"
                  step="1"
                  min={0}
                  required
                  value={formData.reservationCharge || 0}
                  onChange={(e) =>
                    setFormData({ ...formData, reservationCharge: Number(e.target.value) })
                  }
                  className="w-full text-sm border border-slate-300 rounded-lg p-2.5 font-mono focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                  Tatkal Surcharge (₹) *
                </label>
                <input
                  type="number"
                  step="1"
                  min={0}
                  required
                  value={formData.tatkalCharge || 0}
                  onChange={(e) => setFormData({ ...formData, tatkalCharge: Number(e.target.value) })}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2.5 font-mono focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                  GST Percentage (%) *
                </label>
                <input
                  type="number"
                  step="1"
                  min={0}
                  max={28}
                  required
                  value={formData.gstPercentage ?? 5}
                  onChange={(e) => setFormData({ ...formData, gstPercentage: Number(e.target.value) })}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2.5 font-mono focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                Insurance Premium (₹) *
              </label>
              <input
                type="number"
                step="0.01"
                min={0}
                required
                value={formData.insurancePremium || 0}
                onChange={(e) =>
                  setFormData({ ...formData, insurancePremium: Number(e.target.value) })
                }
                className="w-full text-sm border border-slate-300 rounded-lg p-2.5 font-mono focus:ring-2 focus:ring-orange-500 focus:outline-none"
              />
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingFare(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-lg shadow-xs disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Update Fare Rules'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
