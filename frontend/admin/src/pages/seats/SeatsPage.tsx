import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Edit2, Trash2, CheckCircle2, XCircle, Calculator } from 'lucide-react';
import { seatService } from '../../services/seatService';
import { coachService } from '../../services/coachService';
import { trainService } from '../../services/trainService';
import { Seat } from '../../types/seat';
import { Coach } from '../../types/coach';
import { Train } from '../../types/train';
import { BerthType, SeatStatus } from '../../constants/enums';
import { DataTable, Column } from '../../components/DataTable';
import { StatusBadge } from '../../components/StatusBadge';
import { Modal } from '../../components/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PageHeader } from '../../components/PageHeader';
import { hasSegmentOverlap } from '../../utils/seatOverlap';

export const SeatsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const coachIdParam = searchParams.get('coachId');

  const [seats, setSeats] = useState<Seat[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [trains, setTrains] = useState<Train[]>([]);
  const [selectedCoachId, setSelectedCoachId] = useState<string>(coachIdParam || 'ALL');
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSeat, setEditingSeat] = useState<Seat | null>(null);
  const [formData, setFormData] = useState<Omit<Seat, 'seatId'>>({
    coachId: 301,
    seatNumber: 1,
    berthType: 'LOWER',
    seatStatus: 'AVAILABLE',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete State
  const [deletingSeat, setDeletingSeat] = useState<Seat | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Segmented Overlap Interactive Tester State
  const [simStartA, setSimStartA] = useState(1);
  const [simEndA, setSimEndA] = useState(2);
  const [simStartB, setSimStartB] = useState(2);
  const [simEndB, setSimEndB] = useState(4);

  const loadData = async () => {
    setLoading(true);
    try {
      const cId = selectedCoachId !== 'ALL' ? Number(selectedCoachId) : undefined;
      const [sList, cList, tList] = await Promise.all([
        seatService.getSeats(cId),
        coachService.getCoaches(),
        trainService.getTrains(),
      ]);
      setSeats(sList);
      setCoaches(cList);
      setTrains(tList);
    } catch (err) {
      console.error('Failed to load seats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCoachId]);

  const coachMap = new Map(coaches.map((c) => [c.coachId, c]));
  const trainMap = new Map(trains.map((t) => [t.trainId, t]));

  const handleCoachFilterChange = (val: string) => {
    setSelectedCoachId(val);
    if (val === 'ALL') {
      searchParams.delete('coachId');
      setSearchParams(searchParams);
    } else {
      setSearchParams({ coachId: val });
    }
  };

  const handleOpenCreate = () => {
    setEditingSeat(null);
    const defaultCoach = selectedCoachId !== 'ALL' ? Number(selectedCoachId) : coaches[0]?.coachId || 301;
    const existingSeats = seats.filter((s) => s.coachId === defaultCoach);
    const nextSeatNum = existingSeats.length > 0 ? Math.max(...existingSeats.map((s) => s.seatNumber)) + 1 : 1;

    setFormData({
      coachId: defaultCoach,
      seatNumber: nextSeatNum,
      berthType: 'LOWER',
      seatStatus: 'AVAILABLE',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (seat: Seat) => {
    setEditingSeat(seat);
    setFormData({
      coachId: seat.coachId,
      seatNumber: seat.seatNumber,
      berthType: seat.berthType,
      seatStatus: seat.seatStatus,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingSeat) {
        await seatService.updateSeat(editingSeat.seatId, formData);
      } else {
        await seatService.createSeat(formData);
      }
      await loadData();
      setIsModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to save seat.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingSeat) return;
    setIsDeleting(true);
    try {
      await seatService.deleteSeat(deletingSeat.seatId);
      await loadData();
      setDeletingSeat(null);
    } catch (err: any) {
      alert(err.message || 'Failed to delete seat.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Evaluate overlap for simulator
  let simResult = { hasConflict: false, error: '' };
  try {
    const conflict = hasSegmentOverlap(simStartA, simEndA, simStartB, simEndB);
    simResult = { hasConflict: conflict, error: '' };
  } catch (err: any) {
    simResult = { hasConflict: false, error: err.message };
  }

  const columns: Column<Seat>[] = [
    {
      header: 'Seat Number',
      accessorKey: 'seatNumber',
      sortable: true,
      cell: (row) => (
        <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded text-xs">
          #{row.seatNumber}
        </span>
      ),
    },
    {
      header: 'Coach & Train',
      cell: (row) => {
        const coach = coachMap.get(row.coachId);
        const train = coach ? trainMap.get(coach.trainId) : null;
        return (
          <div>
            <span className="font-mono font-bold text-orange-800 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded text-xs">
              Coach {coach?.coachNumber || row.coachId} ({coach?.classType})
            </span>
            <div className="text-xs text-slate-500 mt-0.5">
              {train ? `${train.trainNumber} - ${train.trainName}` : ''}
            </div>
          </div>
        );
      },
    },
    {
      header: 'Berth Configuration',
      accessorKey: 'berthType',
      sortable: true,
      cell: (row) => (
        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
          {row.berthType}
        </span>
      ),
    },
    {
      header: 'Master Availability',
      accessorKey: 'seatStatus',
      sortable: true,
      cell: (row) => <StatusBadge status={row.seatStatus} />,
    },
    {
      header: 'Actions',
      align: 'right',
      cell: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => handleOpenEdit(row)}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
            title="Edit Berth"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setDeletingSeat(row)}
            className="p-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-600 transition-colors"
            title="Delete Berth"
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
        title="Berth Layout & Segmented Allocation Rules"
        description="Physical coach berths, structural seat allocations, and segmented seat integrity rules."
        actions={
          <div className="flex items-center gap-3">
            <select
              value={selectedCoachId}
              onChange={(e) => handleCoachFilterChange(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-700 focus:ring-2 focus:ring-orange-500 focus:outline-none"
            >
              <option value="ALL">All Coaches</option>
              {coaches.map((c) => (
                <option key={c.coachId} value={c.coachId}>
                  Coach {c.coachNumber} ({c.classType}) - Train #{c.trainId}
                </option>
              ))}
            </select>
            <button
              onClick={handleOpenCreate}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Berth</span>
            </button>
          </div>
        }
      />

      {/* Segmented Seat Allocation Rule Live Simulator */}
      <div className="bg-gradient-to-r from-orange-50/70 via-amber-50/40 to-white rounded-xl border border-orange-200 p-5 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-orange-600 text-white">
            <Calculator className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-slate-900">
              Segmented Seat Integrity Verification Engine
            </h3>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Formula: A physical seat on the same train and date can be allocated to two passengers if and only if:
              <code className="mx-1 px-1.5 py-0.5 rounded bg-white border border-slate-200 font-mono text-orange-950 font-bold">
                max(startA, startB) &lt; min(endA, endB)
              </code>
              is <span className="font-bold text-emerald-700">FALSE</span> (segments do not intersect).
            </p>

            {/* Interactive Simulation Inputs */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-white p-4 rounded-xl border border-orange-200/80">
              {/* Passenger A Leg */}
              <div>
                <span className="text-xs font-bold text-slate-700 block mb-1.5">
                  Passenger A (Current Ticket Leg)
                </span>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-400 uppercase font-semibold">Boarding Seq</label>
                    <input
                      type="number"
                      min={1}
                      value={simStartA}
                      onChange={(e) => setSimStartA(Number(e.target.value))}
                      className="w-full text-xs font-mono p-1.5 border border-slate-300 rounded"
                    />
                  </div>
                  <span className="text-slate-400 pt-3">→</span>
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-400 uppercase font-semibold">Alighting Seq</label>
                    <input
                      type="number"
                      min={2}
                      value={simEndA}
                      onChange={(e) => setSimEndA(Number(e.target.value))}
                      className="w-full text-xs font-mono p-1.5 border border-slate-300 rounded"
                    />
                  </div>
                </div>
              </div>

              {/* Passenger B Leg */}
              <div>
                <span className="text-xs font-bold text-slate-700 block mb-1.5">
                  Passenger B (Requested New Leg)
                </span>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-400 uppercase font-semibold">Boarding Seq</label>
                    <input
                      type="number"
                      min={1}
                      value={simStartB}
                      onChange={(e) => setSimStartB(Number(e.target.value))}
                      className="w-full text-xs font-mono p-1.5 border border-slate-300 rounded"
                    />
                  </div>
                  <span className="text-slate-400 pt-3">→</span>
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-400 uppercase font-semibold">Alighting Seq</label>
                    <input
                      type="number"
                      min={2}
                      value={simEndB}
                      onChange={(e) => setSimEndB(Number(e.target.value))}
                      className="w-full text-xs font-mono p-1.5 border border-slate-300 rounded"
                    />
                  </div>
                </div>
              </div>

              {/* Result Indicator */}
              <div className="flex flex-col justify-center border-t md:border-t-0 md:border-l border-slate-100 md:pl-4">
                <span className="text-xs font-bold text-slate-500 uppercase mb-1">Integrity Evaluation</span>
                {simResult.error ? (
                  <span className="text-xs text-rose-600 font-semibold">{simResult.error}</span>
                ) : simResult.hasConflict ? (
                  <div className="flex items-center gap-2 text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-lg text-xs font-bold">
                    <XCircle className="w-4 h-4 flex-shrink-0" />
                    <span>CONFLICT: Overlapping Leg! Allocation Forbidden.</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span>VALID: Disjoint Legs. Seat Can Be Re-sold!</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <DataTable
        data={seats}
        columns={columns}
        loading={loading}
        searchPlaceholder="Search berths by number, coach, type..."
        emptyMessage="No seats configured in coach."
      />

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSeat ? `Edit Berth #${editingSeat.seatNumber}` : 'Configure New Coach Berth'}
        maxWidth="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
              Target Coach *
            </label>
            <select
              value={formData.coachId}
              onChange={(e) => setFormData({ ...formData, coachId: Number(e.target.value) })}
              className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-orange-500 focus:outline-none"
            >
              {coaches.map((c) => (
                <option key={c.coachId} value={c.coachId}>
                  Coach {c.coachNumber} ({c.classType}) - Train #{c.trainId}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                Seat Number *
              </label>
              <input
                type="number"
                min={1}
                required
                value={formData.seatNumber}
                onChange={(e) => setFormData({ ...formData, seatNumber: Number(e.target.value) })}
                className="w-full text-sm border border-slate-300 rounded-lg p-2.5 font-mono focus:ring-2 focus:ring-orange-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                Berth Type *
              </label>
              <select
                value={formData.berthType}
                onChange={(e) => setFormData({ ...formData, berthType: e.target.value as BerthType })}
                className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-orange-500 focus:outline-none"
              >
                <option value="LOWER">LOWER</option>
                <option value="MIDDLE">MIDDLE</option>
                <option value="UPPER">UPPER</option>
                <option value="SIDE_LOWER">SIDE_LOWER</option>
                <option value="SIDE_UPPER">SIDE_UPPER</option>
                <option value="WINDOW">WINDOW</option>
                <option value="AISLE">AISLE</option>
                <option value="NO_BERTH">NO_BERTH</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
              Master Seat Status
            </label>
            <select
              value={formData.seatStatus}
              onChange={(e) => setFormData({ ...formData, seatStatus: e.target.value as SeatStatus })}
              className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-orange-500 focus:outline-none"
            >
              <option value="AVAILABLE">AVAILABLE</option>
              <option value="BOOKED">BOOKED</option>
              <option value="RESERVED">RESERVED</option>
              <option value="BLOCKED">BLOCKED</option>
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
              {isSubmitting ? 'Saving...' : editingSeat ? 'Update Berth' : 'Configure Berth'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deletingSeat}
        title="Delete Berth Record"
        message={`Are you sure you want to delete Berth #${deletingSeat?.seatNumber}?`}
        confirmLabel="Delete Berth"
        isDestructive={true}
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeletingSeat(null)}
      />
    </div>
  );
};
