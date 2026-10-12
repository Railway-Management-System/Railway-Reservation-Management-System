import React, { useState } from 'react';
import { useStaff } from '../context/StaffContext';
import { Clock } from 'lucide-react';
import { Schedule } from '../types';

export const OperationsPage: React.FC = () => {
  const { data, activeStaff, activeSchedule, updateTrainDelay } = useStaff();

  const [delayMinutes, setDelayMinutes] = useState(activeSchedule?.delayMinutes || 0);
  const [status, setStatus] = useState<Schedule['status']>(activeSchedule?.status || 'ON_TIME');
  const [platform, setPlatform] = useState(activeSchedule?.platformNumber || 1);

  const trainId = activeStaff.assignedTrainId || 101;
  const routes = data.routes.filter(r => r.trainId === trainId);

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    updateTrainDelay(delayMinutes, status, platform);
  };

  return (
    <div className="space-y-6">
      {/* Update Form */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
          <Clock className="w-5 h-5 text-orange-600" />
          <span>Update Train Running Status & Platform</span>
        </h3>
        <p className="text-xs text-slate-500 mb-5">
          Broadcast real-time operational updates (delay minutes, operational status, platform reassignments) to station display networks.
        </p>

        <form onSubmit={handleUpdate} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Report Delay (in Minutes)</label>
            <input
              type="number"
              min={0}
              max={600}
              value={delayMinutes}
              onChange={(e) => setDelayMinutes(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-orange-500 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-mono outline-none transition-all"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Operational State</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as Schedule['status'])}
              className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-orange-500 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none cursor-pointer transition-all"
            >
              <option value="ON_TIME">ON_TIME</option>
              <option value="DELAYED">DELAYED</option>
              <option value="RESCHEDULED">RESCHEDULED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Expected Platform Number</label>
            <input
              type="number"
              min={1}
              max={32}
              value={platform}
              onChange={(e) => setPlatform(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-orange-500 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-mono outline-none transition-all"
            />
          </div>

          <div className="sm:col-span-3 flex justify-end pt-2">
            <button
              type="submit"
              className="px-5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-semibold shadow-xs transition-all"
            >
              Broadcast Operational Update
            </button>
          </div>
        </form>
      </div>

      {/* Timetable Table */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <h3 className="text-base font-bold text-slate-900 mb-4">Official Route Timetable & Stoppages</h3>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Stop #</th>
                <th className="py-3 px-4">Station Name</th>
                <th className="py-3 px-4">Scheduled Arrival</th>
                <th className="py-3 px-4">Scheduled Departure</th>
                <th className="py-3 px-4">Distance from Origin</th>
                <th className="py-3 px-4">Assigned Platform</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {routes.map(r => {
                const stn = data.stations.find(s => s.stationId === r.stationId);
                return (
                  <tr key={r.routeId} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-orange-600">{r.stopSequence}</td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900">{stn?.stationName}</span>
                      <span className="text-slate-400 text-[10px] ml-1.5 font-mono">({stn?.stationCode})</span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700">{r.arrivalTime}</td>
                    <td className="py-3 px-4 font-mono text-slate-700">{r.departureTime}</td>
                    <td className="py-3 px-4 text-slate-500">{r.distanceFromOrigin} km</td>
                    <td className="py-3 px-4">
                      <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-mono text-slate-700">
                        PF #{r.platformNumber}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
