import React, { useState } from 'react';
import { useStaff } from '../context/StaffContext';
import { StatusBadge } from '../components/StatusBadge';
import { Search, Check, X, ShieldAlert, Loader2, AlertCircle, RefreshCw } from 'lucide-react';

interface ManifestPageProps {
  onInspectPassenger: (pnr: string) => void;
}

export const ManifestPage: React.FC<ManifestPageProps> = ({ onInspectPassenger }) => {
  const { data, activeStaff, markPassengerBoarding, chartStatus, refreshAssignmentAndChart } = useStaff();
  const [selectedCoach, setSelectedCoach] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');
  const [pendingActionId, setPendingActionId] = useState<number | null>(null);

  const trainId = activeStaff.assignedTrainId || 101;
  let list = data.manifest.filter(m => m.trainId === trainId);

  if (selectedCoach !== 'ALL') {
    list = list.filter(m => m.coachNumber === selectedCoach);
  }

  if (search.trim() !== '') {
    const q = search.toLowerCase().trim();
    list = list.filter(m =>
      m.name.toLowerCase().includes(q) ||
      m.pnr.includes(q) ||
      (m.seatNumber && String(m.seatNumber).includes(q)) ||
      m.idProofReference.toLowerCase().includes(q)
    );
  }

  const coachTabs = ['ALL', 'B1', 'B2', 'A1'];

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        {/* Header & Coach Selectors */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">Passenger Chart & Manifest</h3>
              {chartStatus.prepared && (
                <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                  Live Server Chart
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">Real-time onboard manifest for assigned coaches</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refreshAssignmentAndChart()}
              title="Refresh chart from server"
              className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${chartStatus.loading ? 'animate-spin text-blue-600' : ''}`} />
            </button>
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {coachTabs.map(c => (
                <button
                  key={c}
                  onClick={() => setSelectedCoach(c)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    selectedCoach === c
                      ? 'bg-orange-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {c === 'ALL' ? 'All Assigned' : `Coach ${c}`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {chartStatus.error && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Notice: {chartStatus.error}. Showing roster data.</span>
          </div>
        )}

        {/* Search Bar */}
        <div className="pt-4 pb-5">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by passenger name, PNR, seat number, or ID reference..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-800 outline-none focus:border-orange-500 focus:bg-white transition-all placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Table - Matching Admin DataTable */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Seat / Berth</th>
                <th className="py-3 px-4">Passenger Details</th>
                <th className="py-3 px-4">PNR</th>
                <th className="py-3 px-4">Sector</th>
                <th className="py-3 px-4">Booking</th>
                <th className="py-3 px-4">Official ID</th>
                <th className="py-3 px-4">Boarding</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500 text-xs">
                    No passenger records found matching the filter.
                  </td>
                </tr>
              ) : (
                list.map(p => {
                  const bStation = data.stations.find(s => s.stationId === p.boardingStationId)?.stationCode || 'BCT';
                  const dStation = data.stations.find(s => s.stationId === p.destinationStationId)?.stationCode || 'NDLS';

                  return (
                    <tr key={p.manifestId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        {p.coachNumber && p.seatNumber ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-orange-700 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded text-xs">
                              {p.coachNumber}-{p.seatNumber}
                            </span>
                            <span className="text-[10px] text-slate-500 font-medium">({p.berthType})</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Unallocated</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{p.name}</div>
                        <div className="text-[10px] text-slate-500">{p.age}y / {p.gender} • {p.quota}</div>
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-slate-800">{p.pnr}</td>
                      <td className="py-3 px-4 font-medium text-slate-700">
                        {bStation} ➔ {dStation}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge
                          status={p.bookingStatus === 'RAC' ? `RAC-${p.racRank || 1}` : p.bookingStatus === 'WAITING_LIST' ? `WL-${p.wlRank || 1}` : p.bookingStatus}
                          size="sm"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-[10px] font-bold text-blue-700">{p.idProofType}</div>
                        <div className="font-mono text-[10px] text-slate-500">{p.idProofReference}</div>
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={p.boardingStatus} size="sm" />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            disabled={pendingActionId === p.manifestId}
                            onClick={async () => {
                              setPendingActionId(p.manifestId);
                              try {
                                await markPassengerBoarding(p.manifestId, 'BOARDED');
                              } finally {
                                setPendingActionId(null);
                              }
                            }}
                            title="Mark Boarded"
                            className={`p-1.5 rounded-lg border text-xs font-semibold transition-all ${
                              p.boardingStatus === 'BOARDED'
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-white text-emerald-600 border-slate-200 hover:bg-emerald-50 hover:border-emerald-300'
                            }`}
                          >
                            {pendingActionId === p.manifestId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            disabled={pendingActionId === p.manifestId}
                            onClick={async () => {
                              setPendingActionId(p.manifestId);
                              try {
                                await markPassengerBoarding(p.manifestId, 'NO_SHOW');
                              } finally {
                                setPendingActionId(null);
                              }
                            }}
                            title="Mark No-Show (Frees Berth to RAC)"
                            className={`p-1.5 rounded-lg border text-xs font-semibold transition-all ${
                              p.boardingStatus === 'NO_SHOW'
                                ? 'bg-rose-600 text-white border-rose-600'
                                : 'bg-white text-rose-600 border-slate-200 hover:bg-rose-50 hover:border-rose-300'
                            }`}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onInspectPassenger(p.pnr)}
                            title="Inspect ID & PNR"
                            className="p-1.5 rounded-lg bg-white text-orange-600 border border-slate-200 hover:bg-orange-50 hover:border-orange-300 transition-all"
                          >
                            <ShieldAlert className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
