import React from 'react';
import { useStaff } from '../context/StaffContext';
import { StatusBadge } from '../components/StatusBadge';
import { Armchair, ArrowUpRight } from 'lucide-react';

export const VacanciesPage: React.FC = () => {
  const { data, activeStaff, promoteRacPassenger } = useStaff();

  const trainId = activeStaff.assignedTrainId || 101;
  const vacancies = data.vacancies.filter(v => v.trainId === trainId);
  const racCandidates = data.manifest.filter(m => m.trainId === trainId && (m.bookingStatus === 'RAC' || m.bookingStatus === 'WAITING_LIST'));

  return (
    <div className="space-y-6">
      {/* Vacancies Section */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Armchair className="w-5 h-5 text-orange-600" />
              <span>Live Vacant Berths in Train Pool</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Berths vacated by no-show passengers or cancellations available for dynamic RAC reallocation.
            </p>
          </div>
          <span className="text-xs font-mono font-bold bg-orange-50 text-orange-700 border border-orange-200 px-2.5 py-1 rounded-lg">
            {vacancies.length} Berths Available
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Coach & Seat</th>
                <th className="py-3 px-4">Berth Type</th>
                <th className="py-3 px-4">Vacancy Cause</th>
                <th className="py-3 px-4">Available Sector</th>
                <th className="py-3 px-4 text-right">Quick Allocation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vacancies.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 text-xs">
                    No vacant berths currently registered on this train run.
                  </td>
                </tr>
              ) : (
                vacancies.map(v => {
                  const fromStn = data.stations.find(s => s.stationId === v.availableFromStationId)?.stationCode || 'BCT';
                  const toStn = data.stations.find(s => s.stationId === v.availableToStationId)?.stationCode || 'NDLS';

                  return (
                    <tr key={v.vacancyId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-orange-700 bg-orange-50 border border-orange-200 px-2.5 py-0.5 rounded text-xs">
                          {v.coachNumber}-{v.seatNumber}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{v.berthType}</td>
                      <td className="py-3 px-4 text-slate-600">{v.reason}</td>
                      <td className="py-3 px-4 font-medium text-slate-700">
                        {fromStn} ➔ {toStn}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {racCandidates.length > 0 ? (
                          <button
                            onClick={() => promoteRacPassenger(racCandidates[0].manifestId, v.vacancyId)}
                            className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-semibold flex items-center gap-1.5 ml-auto text-[11px] shadow-xs transition-all"
                          >
                            <span>Promote ({racCandidates[0].name.split(' ')[0]})</span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400">No RAC candidates</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RAC & Waiting List Queue */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">RAC & Waiting List Priority Queue</h3>
            <p className="text-xs text-slate-500 mt-1">Passengers eligible for promotion to confirmed berths in order of ticket timestamp.</p>
          </div>
          <span className="text-xs font-mono font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-lg">
            {racCandidates.length} In Queue
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Priority Rank</th>
                <th className="py-3 px-4">PNR</th>
                <th className="py-3 px-4">Passenger</th>
                <th className="py-3 px-4">Travel Class & Quota</th>
                <th className="py-3 px-4">Boarding State</th>
                <th className="py-3 px-4 text-right">Promote Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {racCandidates.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 text-xs">
                    No RAC or Waiting List passengers on this train.
                  </td>
                </tr>
              ) : (
                racCandidates.map(p => (
                  <tr key={p.manifestId} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <StatusBadge
                        status={p.bookingStatus === 'RAC' ? `RAC-${p.racRank || 1}` : `WL-${p.wlRank || 1}`}
                        size="sm"
                      />
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-slate-800">{p.pnr}</td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{p.name}</div>
                      <div className="text-[10px] text-slate-500">{p.age}y / {p.gender}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-700">{p.classType} • {p.quota}</td>
                    <td className="py-3 px-4">
                      <StatusBadge status={p.boardingStatus} size="sm" />
                    </td>
                    <td className="py-3 px-4 text-right">
                      {vacancies.length > 0 ? (
                        <button
                          onClick={() => promoteRacPassenger(p.manifestId, vacancies[0].vacancyId)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-semibold shadow-xs ml-auto transition-all"
                        >
                          Assign Berth ({vacancies[0].coachNumber}-{vacancies[0].seatNumber})
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">No berths left</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
