import React from 'react';
import { useStaff } from '../context/StaffContext';
import { StatCard } from '../components/StatCard';
import { Train, CheckCircle2, UserX, Armchair, Receipt, ArrowRight } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';

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
    <div className="space-y-6" style={{ fontFamily: "'Inter', 'Plus Jakarta Sans', -apple-system, sans-serif" }}>
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
          value={formatCurrency(totalFines)}
          subtitle={`${data.fines.length} penalties issued`}
          icon={Receipt}
          color="orange"
        />
      </div>

      {/* Duty Assignment Overview Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Current Duty Shift</h3>
              <span className="text-xs font-semibold text-slate-500 ml-1">{activeStaff.shift}</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Officer: <strong className="text-slate-800 font-semibold">{activeStaff.name}</strong>
              {' · '}<span className="text-slate-600">{activeStaff.designation}</span>
              {' · '}<span className="font-mono text-[#2259c2] font-bold">{activeStaff.employeeId}</span>
              {' · '}<strong className="text-slate-800 font-semibold">{station?.stationName || 'NDLS'}</strong>
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setActiveTab('manifest')}
              className="px-4 py-2 bg-[#2259c2] hover:bg-[#1748a5] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
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

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5">
          <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Assigned Coaches</div>
            <div className="text-sm font-extrabold text-slate-900">
              {activeStaff.assignedCoaches.length ? activeStaff.assignedCoaches.join(', ') : 'All Coaches'}
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Operational Status</div>
            <div className={`text-sm font-extrabold ${activeSchedule?.status === 'DELAYED' ? 'text-rose-600' : 'text-emerald-600'}`}>
              {activeSchedule?.status || 'ON_TIME'}
              {activeSchedule?.delayMinutes ? <span className="text-xs font-semibold ml-1 text-rose-500">(+{activeSchedule.delayMinutes} min)</span> : null}
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Current Sector</div>
            <div className="text-sm font-extrabold text-slate-900">
              {activeSchedule?.currentStation || 'Mumbai Central'} → {activeSchedule?.nextStation || 'Surat'}
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Platform</div>
            <div className="text-sm font-extrabold text-slate-900 font-mono">
              Platform #{activeSchedule?.platformNumber || '1'}
            </div>
          </div>
        </div>
      </div>

      {/* SOP Guidelines Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h3 className="text-sm font-extrabold text-slate-900 tracking-tight mb-4">Standard Operating Procedure (SOP) — Quick Reference</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-50 border-l-4 border-blue-500 border border-slate-200 p-4 rounded-2xl">
            <div className="font-bold text-blue-700 text-xs mb-2 uppercase tracking-wide">1. Chart Verification</div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Verify passenger identity against physical documents or DigiLocker. Mark status as <code className="text-emerald-700 font-mono font-bold bg-emerald-50 px-1 rounded">VALID</code>, <code className="text-rose-700 font-mono font-bold bg-rose-50 px-1 rounded">INVALID</code>, or <code className="text-amber-700 font-mono font-bold bg-amber-50 px-1 rounded">MISMATCH</code>.
            </p>
          </div>
          <div className="bg-slate-50 border-l-4 border-emerald-500 border border-slate-200 p-4 rounded-2xl">
            <div className="font-bold text-emerald-700 text-xs mb-2 uppercase tracking-wide">2. No-Show & RAC Promotion</div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Mark absent passengers as <code className="text-rose-700 font-mono font-bold bg-rose-50 px-1 rounded">NO_SHOW</code> after departure. Their berth automatically promotes waitlisted RAC passengers.
            </p>
          </div>
          <div className="bg-slate-50 border-l-4 border-[#2259c2] border border-slate-200 p-4 rounded-2xl">
            <div className="font-bold text-[#2259c2] text-xs mb-2 uppercase tracking-wide">3. On-Spot Fines & Challans</div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Issue instant digital penalty challans for ticketless or irregular travel. Generate printable IRCTC e-receipts on the mobile terminal.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
