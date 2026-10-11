import React, { useState } from 'react';
import { useStaff } from '../context/StaffContext';
import { StatusBadge } from '../components/StatusBadge';
import { Users, Sparkles, Check } from 'lucide-react';

export const CrowdCleanPage: React.FC = () => {
  const { data, activeStaff, addCrowdReport, addCleanlinessReport, resolveCleanlinessReport } = useStaff();

  // Crowd Form State
  const [platform, setPlatform] = useState(1);
  const [crowdLevel, setCrowdLevel] = useState<'LOW' | 'MODERATE' | 'HIGH' | 'OVERCROWDED'>('MODERATE');
  const [headCount, setHeadCount] = useState(250);

  // Clean Form State
  const [issueType, setIssueType] = useState('TOILET_DIRTY');
  const [description, setDescription] = useState('');

  const handleCrowdSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addCrowdReport({
      stationId: activeStaff.assignedStationId || 1,
      platformNumber: platform,
      crowdLevel,
      headCount,
      recordedBy: activeStaff.staffId
    });
  };

  const handleCleanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;
    addCleanlinessReport({
      reportedBy: activeStaff.staffId,
      trainId: activeStaff.assignedTrainId || 101,
      coachId: 301,
      stationId: activeStaff.assignedStationId,
      platformNumber: platform,
      issueType,
      description: description.trim()
    });
    setDescription('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Crowd Monitoring Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-orange-600" />
            <span>Platform Crowd Assessment</span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">Record live passenger density levels and headcounts.</p>
        </div>

        <form onSubmit={handleCrowdSubmit} className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-700 block mb-1">Platform #</label>
              <input
                type="number"
                min={1}
                max={24}
                value={platform}
                onChange={(e) => setPlatform(Number(e.target.value))}
                className="w-full bg-white border border-slate-200 focus:border-orange-500 rounded-lg px-3 py-1.5 text-xs text-slate-800 outline-none font-mono"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-700 block mb-1">Density Grade</label>
              <select
                value={crowdLevel}
                onChange={(e) => setCrowdLevel(e.target.value as any)}
                className="w-full bg-white border border-slate-200 focus:border-orange-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 outline-none cursor-pointer"
              >
                <option value="LOW">LOW</option>
                <option value="MODERATE">MODERATE</option>
                <option value="HIGH">HIGH</option>
                <option value="OVERCROWDED">OVERCROWDED</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-700 block mb-1">Estimated Pax Headcount</label>
            <input
              type="number"
              min={10}
              step={20}
              value={headCount}
              onChange={(e) => setHeadCount(Number(e.target.value))}
              className="w-full bg-white border border-slate-200 focus:border-orange-500 rounded-lg px-3 py-1.5 text-xs text-slate-800 outline-none font-mono"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-xs font-semibold shadow-xs transition-all mt-1"
          >
            Record Crowd Assessment
          </button>
        </form>

        <div>
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Recent Crowd Records:</h4>
          <div className="space-y-2">
            {data.crowdReports.slice(0, 4).map(c => {
              const stn = data.stations.find(s => s.stationId === c.stationId);
              return (
                <div key={c.crowdReportId} className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-900">{stn?.stationCode || 'NDLS'}</span>
                    <span className="text-slate-500 ml-2">Platform {c.platformNumber}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-slate-700 font-medium">~{c.headCount} pax</span>
                    <StatusBadge status={c.crowdLevel} size="sm" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Cleanliness / Hygiene Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-orange-600" />
            <span>Housekeeping & Hygiene Tickets</span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">Dispatch cleaning crews for washroom, litter, or AC complaints.</p>
        </div>

        <form onSubmit={handleCleanSubmit} className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div>
            <label className="text-[11px] font-semibold text-slate-700 block mb-1">Issue Category</label>
            <select
              value={issueType}
              onChange={(e) => setIssueType(e.target.value)}
              className="w-full bg-white border border-slate-200 focus:border-orange-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 outline-none cursor-pointer"
            >
              <option value="TOILET_DIRTY">TOILET_DIRTY (Washroom unsanitary)</option>
              <option value="LITTER">LITTER (Garbage accumulation)</option>
              <option value="WATER_SHORTAGE">WATER_SHORTAGE (Overhead tank empty)</option>
              <option value="AC_NOT_WORKING">AC_NOT_WORKING (Cooling defect)</option>
              <option value="SEAT_DAMAGED">SEAT_DAMAGED (Upholstery torn)</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-700 block mb-1">Location Details & Description *</label>
            <textarea
              required
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Coach B1 toilet water pressure issue, passenger reported..."
              className="w-full bg-white border border-slate-200 focus:border-orange-500 rounded-lg p-2.5 text-xs text-slate-800 outline-none placeholder:text-slate-400 resize-none"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-all"
          >
            Dispatch Housekeeping Ticket
          </button>
        </form>

        <div>
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Active Hygiene Tickets:</h4>
          <div className="space-y-2">
            {data.cleanlinessReports.map(r => (
              <div key={r.reportId} className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <div className="font-semibold text-slate-900">{r.issueType.replace(/_/g, ' ')}</div>
                  <div className="text-[11px] text-slate-500 truncate max-w-[200px]">{r.description}</div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={r.status} size="sm" />
                  {r.status !== 'RESOLVED' && (
                    <button
                      onClick={() => resolveCleanlinessReport(r.reportId)}
                      className="p-1 rounded bg-white hover:bg-emerald-600 text-slate-600 hover:text-white border border-slate-200 transition-colors"
                      title="Mark Resolved"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
