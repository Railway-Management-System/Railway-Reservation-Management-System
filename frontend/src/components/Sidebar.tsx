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
  RotateCcw
} from 'lucide-react';
import { useStaff } from '../context/StaffContext';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const { data, activeStaff, switchStaff, resetData } = useStaff();

  const trainId = activeStaff.assignedTrainId || 101;
  const manifest = data.manifest.filter(m => m.trainId === trainId);
  const unverifiedCount = manifest.filter(m => m.boardingStatus === 'NOT_VERIFIED').length;
  const vacancyCount = data.vacancies.filter(v => v.trainId === trainId).length;
  const fineCount = data.fines.length;
  const emergencyCount = data.incidents.filter(i => i.status !== 'RESOLVED').length;

  const navSections = [
    {
      title: 'OVERVIEW',
      items: [
        { id: 'overview', label: 'Duty Dashboard', icon: LayoutDashboard },
      ],
    },
    {
      title: 'ONBOARD ROSTER & PASSENGERS',
      items: [
        { id: 'manifest', label: 'Passenger Chart', icon: Users, badge: unverifiedCount },
        { id: 'scanner', label: 'PNR & ID Scanner', icon: Search },
        { id: 'vacancies', label: 'Vacancies & RAC', icon: Armchair, badge: vacancyCount },
      ],
    },
    {
      title: 'ENFORCEMENT & DISPATCH',
      items: [
        { id: 'fines', label: 'On-Spot Penalties', icon: FileText, badge: fineCount },
        { id: 'operations', label: 'Delays & Platform', icon: Clock },
        { id: 'crowd_clean', label: 'Crowd & Hygiene', icon: Sparkles },
      ],
    },
    {
      title: 'SAFETY & EMERGENCY',
      items: [
        { id: 'emergency', label: 'Emergency SOS', icon: AlertOctagon, badge: emergencyCount, isDanger: true },
      ],
    },
  ];

  return (
    <aside className="w-72 bg-slate-900 text-slate-300 flex flex-col h-screen sticky top-0 z-40 border-r border-slate-800">
      {/* Brand Header - Matching Admin Portal */}
      <div className="h-16 px-6 flex items-center justify-between border-b border-slate-800 bg-slate-950/40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-600 flex items-center justify-center text-white font-bold shadow-md shadow-orange-950/50">
            <Train className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-white text-base tracking-tight leading-none">
              RRMS Staff
            </div>
            <div className="text-[11px] text-orange-400 font-semibold tracking-wide uppercase mt-1">
              Conductor & TC Terminal
            </div>
          </div>
        </div>
      </div>

      {/* Nav Sections */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6 scrollbar-thin">
        {navSections.map((section, sIdx) => (
          <div key={sIdx}>
            <div className="px-3 mb-2 text-[10px] font-bold tracking-wider text-slate-500 uppercase">
              {section.title}
            </div>
            <div className="space-y-1">
              {section.items.map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-orange-600 text-white shadow-xs font-semibold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    } ${item.isDanger && !isActive ? 'hover:text-rose-400' : ''}`}
                  >
                    <Icon className={`w-4 h-4 flex-shrink-0 ${item.isDanger ? 'text-rose-400' : isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full font-bold ${
                        item.isDanger
                          ? 'bg-rose-500/20 text-rose-300'
                          : isActive
                          ? 'bg-orange-700 text-white'
                          : 'bg-slate-800 text-slate-300'
                      }`}>
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

      {/* Footer User Card - Matching Admin Layout */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/30 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-orange-700/80 text-white font-bold flex items-center justify-center text-sm border border-orange-500/30">
            {activeStaff.name ? activeStaff.name[0].toUpperCase() : 'T'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">{activeStaff.name}</p>
            <p className="text-[11px] text-orange-400 font-mono">{activeStaff.employeeId} • {activeStaff.status}</p>
          </div>
          <button
            onClick={() => {
              if (window.confirm('Reset all demo staff data back to mock fixtures?')) {
                resetData();
              }
            }}
            title="Reset Mock State"
            className="text-slate-400 hover:text-orange-400 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Personnel Switcher Dropdown */}
        <select
          value={activeStaff.staffId}
          onChange={(e) => switchStaff(Number(e.target.value))}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-slate-300 outline-none focus:border-orange-500 cursor-pointer"
        >
          {data.staffList.map(s => (
            <option key={s.staffId} value={s.staffId}>
              Officer: {s.name} ({s.designation.split(' ')[0]})
            </option>
          ))}
        </select>
      </div>
    </aside>
  );
};
