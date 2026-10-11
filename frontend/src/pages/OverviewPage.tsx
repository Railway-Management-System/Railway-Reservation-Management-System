import React from 'react';
import { useStaff } from '../context/StaffContext';
import { StatCard } from '../components/StatCard';
import { Train, CheckCircle2, UserX, Armchair, Receipt, ArrowRight } from 'lucide-react';

interface OverviewPageProps {
  setActiveTab: (tab: string) => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({ setActiveTab }) => {
  const { data, activeStaff, activeTrain, activeSchedule } = useStaff();

  const trainId = activeStaff.assignedTrainId || 101;
  const manifest = data.manifest.filter(m => m.trainId === trainId);
  const totalPassengers = manifest.length;
  const boardedCount = manifest.filter(m => m.boardingStatus === 'BOARDED').length;
  const noShowCount = manifest.filter(m => m.boardingStatus === 'NO_SHOW').length;
  const pendingCount = manifest.filter(m => m.boardingStatus === 'NOT_VERIFIED').length;
  const vacancies = data.vacancies.filter(v => v.trainId === trainId).length;
  const racCount = manifest.filter(m => m.bookingStatus === 'RAC').length;
  const totalFines = data.fines.reduce((acc, f) => acc + Number(f.amount), 0);

  const station = data.stations.find(s => s.stationId === activeStaff.assignedStationId);

  return (
    <div className="space-y-6">
      {/* Stat Cards - Matching Admin Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Assigned Train"
          value={activeTrain?.trainNumber || 'N/A'}
          subtitle={activeTrain?.trainName || 'Station Operations'}
          icon={Train}
          color="blue"
        />

        <StatCard
          title="Boarded Passengers"
          value={`${boardedCount} / ${totalPassengers}`}
          subtitle={`${pendingCount} Pending Check`}
          icon={CheckCircle2}
          color="emerald"
        />

        <StatCard
          title="No-Shows Recorded"
          value={noShowCount}
          subtitle="Berths released to pool"
          icon={UserX}
          color="rose"
        />

        <StatCard
          title="Vacant Berths"
          value={vacancies}
          subtitle={`${racCount} RAC in queue`}
          icon={Armchair}
          color="amber"
        />

        <StatCard
          title="Fines Collected"
          value={`₹${totalFines.toFixed(0)}`}
          subtitle={`${data.fines.length} penalties issued`}
          icon={Receipt}
          color="orange"
        />
      </div>

      {/* Duty Assignment Overview Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <h3 className="text-base font-bold text-slate-900">Current Duty Shift: {activeStaff.shift}</h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Officer: <strong className="text-slate-800">{activeStaff.name}</strong> • Role: <span className="font-medium text-slate-700">{activeStaff.designation}</span> • ID: <span className="font-mono text-orange-600 font-semibold">{activeStaff.employeeId}</span> • Station: <strong className="text-slate-800">{station?.stationName || 'NDLS'}</strong>
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setActiveTab('manifest')}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
            >
              <span>Inspect Manifest</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setActiveTab('scanner')}
              className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-all"
            >
              Quick PNR Scan
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-5">
          <div className="bg-slate-50/70 border border-slate-100 p-3.5 rounded-xl">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Assigned Coaches</div>
            <div className="text-sm font-bold text-slate-900 mt-1">
              {activeStaff.assignedCoaches.length ? activeStaff.assignedCoaches.join(', ') : 'All Coaches'}
            </div>
          </div>
          <div className="bg-slate-50/70 border border-slate-100 p-3.5 rounded-xl">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Operational Status</div>
            <div className={`text-sm font-bold mt-1 ${activeSchedule?.status === 'DELAYED' ? 'text-rose-600' : 'text-emerald-600'}`}>
              {activeSchedule?.status || 'ON_TIME'} {activeSchedule?.delayMinutes ? `(+${activeSchedule.delayMinutes} min late)` : ''}
            </div>
          </div>
          <div className="bg-slate-50/70 border border-slate-100 p-3.5 rounded-xl">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Current Sector</div>
            <div className="text-sm font-bold text-slate-900 mt-1">
              {activeSchedule?.currentStation || 'Mumbai Central'} ➔ {activeSchedule?.nextStation || 'Surat'}
            </div>
          </div>
          <div className="bg-slate-50/70 border border-slate-100 p-3.5 rounded-xl">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Platform Allocation</div>
            <div className="text-sm font-bold text-slate-900 mt-1 font-mono">
              Platform #{activeSchedule?.platformNumber || '1'}
            </div>
          </div>
        </div>
      </div>

      {/* SOP Guidelines Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 mb-4">Standard Operating Procedure (SOP) Quick Guide</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
            <div className="font-semibold text-blue-700 text-xs mb-1">1. Chart Verification</div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Verify passenger identity proofs against physical documents or DigiLocker. Stamp passenger status as <code className="text-emerald-700 font-mono font-semibold">VALID</code>, <code className="text-rose-700 font-mono font-semibold">INVALID</code>, or <code className="text-amber-700 font-mono font-semibold">MISMATCH</code>.
            </p>
          </div>
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
            <div className="font-semibold text-emerald-700 text-xs mb-1">2. No-Show & RAC Promotion</div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Absent passengers after departure must be marked <code className="text-rose-700 font-mono font-semibold">NO_SHOW</code>. Their berth automatically moves to the Vacancy Pool to promote waitlisted RAC passengers.
            </p>
          </div>
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
            <div className="font-semibold text-orange-700 text-xs mb-1">3. On-Spot Fines & Challans</div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Issue instant digital penalty challans for ticketless or irregular travel. Generate printable IRCTC e-receipts directly on the mobile terminal.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
