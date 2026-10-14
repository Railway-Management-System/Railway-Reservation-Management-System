import React from 'react';
import {
  LayoutDashboard,
  Users,
  Search,
  Armchair,
  FileText,
  Clock,
  Sparkles,
  AlertOctagon,
  Train,
  RotateCcw,
  ChevronDown,
} from 'lucide-react';
import { useStaff } from '../context/StaffContext';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const { data, activeStaff, switchStaff, resetData } = useStaff();

  const trainId = activeStaff.assignedTrainId || 101;
  const manifest = data.manifest.filter((m) => m.trainId === trainId);
  const unverifiedCount = manifest.filter((m) => m.boardingStatus === 'NOT_VERIFIED').length;
  const vacancyCount = data.vacancies.filter((v) => v.trainId === trainId).length;
  const fineCount = data.fines.length;
  const emergencyCount = data.incidents.filter((i) => i.status !== 'RESOLVED').length;

  const navSections = [
    {
      title: 'Overview',
      items: [{ id: 'overview', label: 'Duty Dashboard', icon: LayoutDashboard }],
    },
    {
      title: 'Onboard Roster & Passengers',
      items: [
        { id: 'manifest', label: 'Passenger Chart', icon: Users, badge: unverifiedCount },
        { id: 'scanner', label: 'PNR & ID Scanner', icon: Search },
        { id: 'vacancies', label: 'Vacancies & RAC', icon: Armchair, badge: vacancyCount },
      ],
    },
    {
      title: 'Enforcement & Dispatch',
      items: [
        { id: 'fines', label: 'On-Spot Penalties', icon: FileText, badge: fineCount },
        { id: 'operations', label: 'Delays & Platform', icon: Clock },
        { id: 'crowd_clean', label: 'Crowd & Hygiene', icon: Sparkles },
      ],
    },
    {
      title: 'Safety & Emergency',
      items: [
        {
          id: 'emergency',
          label: 'Emergency SOS',
          icon: AlertOctagon,
          badge: emergencyCount,
          isDanger: true,
        },
      ],
    },
  ];

  const initials = activeStaff.name
    ? activeStaff.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'TC';

  return (
    <aside
      className="w-72 bg-slate-900 text-slate-300 flex flex-col h-screen sticky top-0 z-40 border-r border-slate-800"
      style={{ fontFamily: "'Inter', 'Plus Jakarta Sans', -apple-system, sans-serif" }}
    >
      {/* Brand Header */}
      <div className="h-16 px-5 flex items-center gap-3 border-b border-slate-800 bg-slate-950/60">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center shadow-md shadow-orange-950/40">
          <Train className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="font-extrabold text-white text-[15px] tracking-tight leading-none">RRMS Staff</div>
          <div className="text-[10px] text-orange-400 font-bold tracking-widest uppercase mt-1">
            Conductor & TC Terminal
          </div>
        </div>
      </div>

      {/* Nav Sections */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {navSections.map((section, sIdx) => (
          <div key={sIdx}>
            <div className="px-3 mb-2 text-[10px] font-bold tracking-widest text-slate-500 uppercase">
              {section.title}
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all cursor-pointer ${
                      isActive
                        ? 'bg-orange-600 text-white shadow-sm font-semibold'
                        : `text-slate-400 hover:text-white hover:bg-slate-800/70 ${item.isDanger && !isActive ? 'hover:text-rose-400' : ''}`
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 flex-shrink-0 ${
                        item.isDanger ? 'text-rose-400' : isActive ? 'text-white' : 'text-slate-500'
                      }`}
                    />
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${
                          item.isDanger
                            ? 'bg-rose-500/25 text-rose-300 border border-rose-500/30'
                            : isActive
                            ? 'bg-orange-700/80 text-white'
                            : 'bg-slate-700/80 text-slate-300'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer: Staff Profile Card */}
      <div className="border-t border-slate-800 bg-slate-950/40 p-4 space-y-3">
        {/* Profile Row */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-500 to-orange-700 text-white font-bold flex items-center justify-center text-sm shadow-md flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-white truncate leading-tight">{activeStaff.name}</p>
            <p className="text-[10px] text-orange-400 font-semibold mt-0.5 truncate">
              {activeStaff.employeeId}
              <span
                className={`ml-1.5 inline-block px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                  activeStaff.status === 'ON_DUTY'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-700 text-slate-400'
                }`}
              >
                {activeStaff.status}
              </span>
            </p>
          </div>
          <button
            onClick={() => {
              if (window.confirm('Reset all demo staff data back to mock fixtures?')) {
                resetData();
              }
            }}
            title="Reset Mock State"
            className="text-slate-500 hover:text-orange-400 p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer flex-shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Personnel Switcher */}
        <div className="relative">
          <select
            value={activeStaff.staffId}
            onChange={(e) => switchStaff(Number(e.target.value))}
            className="w-full appearance-none bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 pr-7 text-[12px] text-slate-200 font-medium outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 cursor-pointer transition-colors"
          >
            {data.staffList.map((s) => (
              <option key={s.staffId} value={s.staffId} className="bg-slate-900">
                {s.name} — {s.designation.split(' ')[0]}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        </div>
      </div>
    </aside>
  );
};
