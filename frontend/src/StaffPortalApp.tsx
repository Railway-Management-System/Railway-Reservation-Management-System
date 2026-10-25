import React, { useState, useEffect, useRef } from 'react';
import { ToastContainer } from './components/ToastContainer';
import { ReceiptModal } from './components/ReceiptModal';
import { OverviewPage } from './pages/OverviewPage';
import { ManifestPage } from './pages/ManifestPage';
import { ScannerPage } from './pages/ScannerPage';
import { VacanciesPage } from './pages/VacanciesPage';
import { FinesPage } from './pages/FinesPage';
import { OperationsPage } from './pages/OperationsPage';
import { CrowdCleanPage } from './pages/CrowdCleanPage';
import { EmergencyPage } from './pages/EmergencyPage';
import { CounterBookingPage } from './pages/CounterBookingPage';
import { MaintenanceTasksPage } from './pages/MaintenanceTasksPage';
import { useStaff } from './context/StaffContext';
import { authService } from './admin/services/authService';
import {
  Search, Train, Clock, ChevronDown, LogOut, RotateCcw,
  LayoutDashboard, Users, Armchair, FileText, AlertOctagon,
  Sparkles, Home, User, Badge, ArrowRight, Ticket, Wrench
} from 'lucide-react';

/* ─── Nav data ──────────────────────────────────────────────────────────── */
interface NavItem {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  badgeKey?: string;
  isDanger?: boolean;
}
interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Onboard Roster & Passengers',
    items: [
      { id: 'manifest',  label: 'Passenger Chart',  description: 'Manifest list, boarding status and ID verification', icon: Users,   badgeKey: 'unverified' },
      { id: 'scanner',   label: 'PNR & ID Scanner', description: 'Scan PNR barcodes, validate tickets and ID proofs',   icon: Search },
      { id: 'vacancies', label: 'Vacancies & RAC',  description: 'Empty berths, RAC queue and upgrade promotions',       icon: Armchair, badgeKey: 'vacancies' },
      { id: 'counter',   label: 'Counter Booking',  description: 'Station walk-in ticket booking & cash collection',   icon: Ticket },
    ],
  },
  {
    title: 'Enforcement & Maintenance',
    items: [
      { id: 'fines',       label: 'On-Spot Penalties', description: 'Issue challans for ticketless or irregular travel',   icon: FileText, badgeKey: 'fines' },
      { id: 'operations',  label: 'Delays & Platform', description: 'Log train delays, platform changes and announcements', icon: Clock },
      { id: 'crowd_clean', label: 'Crowd & Hygiene',   description: 'Crowd density reports and cleanliness monitoring',    icon: Sparkles },
      { id: 'maintenance', label: 'Maintenance Tasks', description: 'Coach mechanical inspection & job order dispatch',    icon: Wrench },
    ],
  },
  {
    title: 'Safety & Emergency',
    items: [
      { id: 'emergency', label: 'Emergency SOS', description: 'Raise safety incidents, SOS alerts and dispatch logs', icon: AlertOctagon, badgeKey: 'emergency', isDanger: true },
    ],
  },
];

/* ─── Component ─────────────────────────────────────────────────────────── */
export const StaffPortalApp: React.FC = () => {
  const { data, activeStaff, activeTrain, switchStaff, resetData } = useStaff();

  const [activeTab,         setActiveTab]         = useState<string>('overview');
  const [scannerPrefillPnr, setScannerPrefillPnr] = useState<string>('');
  const [finePrefill,       setFinePrefill]       = useState<{ name: string; idRef: string; reason: string } | null>(null);
  const [profileOpen,       setProfileOpen]       = useState(false);
  const [activeDropdown,    setActiveDropdown]    = useState<string | null>(null);
  const [timeStr,           setTimeStr]           = useState('');

  const profileRef = useRef<HTMLDivElement>(null);
  const navRef     = useRef<HTMLDivElement>(null);

  /* Live clock */
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
        '  ' +
        now.toLocaleTimeString('en-US', { hour12: false })
      );
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  /* Close dropdowns on outside click */
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
      if (navRef.current    && !navRef.current.contains(e.target as Node))     setActiveDropdown(null);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleInspectPassenger = (pnr: string) => { setScannerPrefillPnr(pnr); setActiveTab('scanner'); setActiveDropdown(null); };
  const handleIssueFinePrefill = (name: string, idRef: string, reason: string) => {
    setFinePrefill({ name, idRef, reason }); setActiveTab('fines'); setActiveDropdown(null);
  };
  const handleLogout = () => { authService.staffLogout(); window.location.href = '/'; };

  /* Badge counts */
  const trainId  = activeStaff.assignedTrainId || 101;
  const manifest = data.manifest.filter(m => m.trainId === trainId);
  const badges: Record<string, number> = {
    unverified: manifest.filter(m => m.boardingStatus === 'NOT_VERIFIED').length,
    vacancies:  data.vacancies.filter(v => v.trainId === trainId).length,
    fines:      data.fines.length,
    emergency:  data.incidents.filter(i => i.status !== 'RESOLVED').length,
  };

  /* Which section contains the active tab */
  const activeSection = NAV_SECTIONS.find(s => s.items.some(i => i.id === activeTab));

  const initials = activeStaff.name
    ? activeStaff.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'TC';

  return (
    <div
      className="min-h-screen bg-[#f5f7fb] flex flex-col text-[#172338]"
      style={{ fontFamily: "'Inter', 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
    >
      {/* ── ROW 1: PRIMARY TOPBAR ─────────────────────────────────────── */}
      <header className="h-[72px] px-4 sm:px-8 bg-white border-b border-[#e9edf4] flex items-center justify-between sticky top-0 z-[100] shadow-sm">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <a href="/" className="flex items-center gap-3 group">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md shadow-[#2259c2]/20 transition-transform group-hover:scale-105"
              style={{ background: 'linear-gradient(135deg, #2259c2 0%, #1748a5 100%)' }}
            >
              <Train className="w-5 h-5 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-bold text-sm sm:text-[15px] tracking-tight text-[#16243b]">RRMS Staff</div>
              <div className="text-[11px] font-bold text-[#2259c2] mt-0.5 uppercase tracking-widest">Conductor & TC Terminal</div>
            </div>
          </a>
        </div>

        {/* Centre: Quick PNR Search */}
        <div className="hidden md:flex items-center flex-1 max-w-lg mx-6 lg:mx-10">
          <button
            type="button"
            onClick={() => { setActiveTab('scanner'); setActiveDropdown(null); }}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] text-[13px] text-[#64748b] hover:border-[#cbd5e1] hover:bg-white hover:shadow-sm transition-all shadow-sm cursor-pointer"
          >
            <Search className="w-4 h-4 text-[#2259c2]" />
            <span className="font-medium text-slate-500">Quick PNR Search…</span>
          </button>
        </div>

        {/* Right area */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Active Train Pill */}
          {activeTrain && (
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50 text-blue-900 text-xs font-bold">
              <Train className="w-3.5 h-3.5 text-[#2259c2]" />
              <span>#{activeTrain.trainNumber}</span>
              <span className="font-medium text-[#2259c2]">— {activeTrain.trainName?.split(' ').slice(0, 3).join(' ')}</span>
            </div>
          )}

          {/* Home */}
          <a
            href="/"
            className="hidden lg:flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Home</span>
          </a>

          {/* Live Clock */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[11px] font-mono text-slate-600">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{timeStr}</span>
          </div>

          {/* Profile Dropdown */}
          <div className="relative" ref={profileRef} style={{ zIndex: 9999 }}>
            <button
              onClick={() => setProfileOpen(v => !v)}
              className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-[#f3f5f9] transition-all cursor-pointer"
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[13px] font-bold shadow-sm"
                style={{ background: 'linear-gradient(135deg, #2259c2, #1748a5)' }}
              >
                {initials}
              </div>
              <div className="hidden sm:flex flex-col text-left leading-tight">
                <span className="text-[13px] font-bold text-[#16243b]">{activeStaff.name}</span>
                <span className="text-[11px] font-semibold text-[#2259c2] uppercase tracking-wide">
                  {activeStaff.designation?.split(' ')[0] || 'TICKET'}
                </span>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-400 hidden sm:block ml-0.5 transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`} />
            </button>

            {profileOpen && (
              <div
                className="absolute right-0 mt-2 w-72 bg-white rounded-2xl border border-[#e2e8f0] py-2.5 overflow-hidden"
                style={{ zIndex: 99999, boxShadow: '0 20px 50px rgba(15,23,42,0.18)' }}
              >
                {/* Profile header */}
                <div className="px-4 py-3 border-b border-[#f1f5f9] bg-gradient-to-br from-blue-50/70 to-slate-50">
                  <div className="flex items-center gap-3 mb-2.5">
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-md"
                      style={{ background: 'linear-gradient(135deg, #2259c2, #1748a5)' }}
                    >
                      {initials}
                    </div>
                    <div className="leading-tight">
                      <p className="text-sm font-bold text-[#0f172a]">{activeStaff.name}</p>
                      <p className="text-xs text-slate-500 font-medium">{activeStaff.designation}</p>
                      <p className="text-[10px] font-mono text-slate-400">{activeStaff.employeeId}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                      activeStaff.status === 'ON_DUTY'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}>
                      {activeStaff.status === 'ON_DUTY' ? '● ON DUTY' : '○ OFF DUTY'}
                    </span>
                    <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-[#2259c2] border border-blue-200">
                      {activeStaff.shift?.split('(')[1]?.replace(')', '') || 'Staff'}
                    </span>
                  </div>
                </div>

                {/* Detail rows */}
                <div className="px-4 py-3 space-y-2.5">
                  <div className="flex items-center gap-2.5 text-xs">
                    <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="text-slate-500 w-28">Employee ID</span>
                    <span className="font-mono font-semibold text-slate-800">{activeStaff.employeeId}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-xs">
                    <Train className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="text-slate-500 w-28">Assigned Train</span>
                    <span className="font-semibold text-slate-800">
                      {activeTrain ? `#${activeTrain.trainNumber}` : 'Station Duty'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 text-xs">
                    <Badge className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="text-slate-500 w-28">Coaches</span>
                    <span className="font-semibold text-slate-800">
                      {activeStaff.assignedCoaches?.length ? activeStaff.assignedCoaches.join(', ') : 'All'}
                    </span>
                  </div>
                </div>

                {/* Officer switcher */}
                <div className="px-4 pb-2">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Switch Officer</div>
                  <select
                    value={activeStaff.staffId}
                    onChange={e => { switchStaff(Number(e.target.value)); setProfileOpen(false); }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[12px] text-slate-700 font-medium outline-none focus:border-[#2259c2] cursor-pointer"
                  >
                    {data.staffList.map(s => (
                      <option key={s.staffId} value={s.staffId}>
                        {s.name} — {s.designation.split(' ')[0]}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Actions */}
                <div className="px-4 py-2 border-t border-slate-100 flex items-center gap-2">
                  <button
                    onClick={() => { if (window.confirm('Reset all demo staff data?')) { resetData(); setProfileOpen(false); } }}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset Data
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── ROW 2: HORIZONTAL NAV WITH DROPDOWN SECTIONS ──────────────── */}
      <nav
        ref={navRef}
        className="bg-white border-b border-[#e5e9f1] px-4 sm:px-8 relative z-50 shadow-sm"
      >
        <div className="flex items-center gap-1 sm:gap-2 py-1.5">
          {/* Overview — direct tab (no dropdown) */}
          <button
            onClick={() => { setActiveTab('overview'); setActiveDropdown(null); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'overview'
                ? 'text-[#2259c2] bg-blue-50/80 shadow-sm'
                : 'text-[#475569] hover:text-[#0f172a] hover:bg-slate-50'
            }`}
          >
            <LayoutDashboard className={`w-4 h-4 ${activeTab === 'overview' ? 'text-[#2259c2]' : 'text-slate-400'}`} />
            <span>Overview</span>
          </button>

          {/* Grouped section dropdowns */}
          {NAV_SECTIONS.map(sec => {
            const isSecActive = activeSection?.title === sec.title;
            const isOpen      = activeDropdown === sec.title;

            // Total badge for this section
            const secBadge = sec.items.reduce((acc, item) => acc + (item.badgeKey ? badges[item.badgeKey] || 0 : 0), 0);

            return (
              <div key={sec.title} className="relative">
                <button
                  type="button"
                  onClick={() => setActiveDropdown(isOpen ? null : sec.title)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
                    isSecActive
                      ? 'text-[#2259c2] bg-blue-50/80 shadow-sm'
                      : isOpen
                      ? 'text-[#0f172a] bg-slate-100'
                      : 'text-[#475569] hover:text-[#0f172a] hover:bg-slate-50'
                  }`}
                >
                  <span>{sec.title.split(' & ')[0]}{sec.title.includes(' & ') ? ' & ' + sec.title.split(' & ')[1] : ''}</span>
                  {secBadge > 0 && !isOpen && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      sec.title === 'Safety & Emergency'
                        ? 'bg-rose-500 text-white'
                        : 'bg-blue-100 text-[#2259c2]'
                    }`}>
                      {secBadge}
                    </span>
                  )}
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${
                    isOpen ? 'rotate-180 text-[#2259c2]' : isSecActive ? 'text-[#2259c2]' : 'text-slate-400'
                  }`} />
                </button>

                {/* Dropdown Panel — matches admin style exactly */}
                {isOpen && (
                  <div
                    className="absolute left-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-2xl border border-[#e2e8f0] p-2.5"
                    style={{ zIndex: 9999, boxShadow: '0 24px 70px rgba(15,23,42,0.20)' }}
                  >
                    {/* Dropdown header */}
                    <div className="px-3.5 py-2.5 mb-1.5 border-b border-slate-100 flex items-center justify-between">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                        {sec.title} Submodules
                      </span>
                      <span className="text-xs text-[#2259c2] font-bold bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200/60">
                        {sec.items.length} views
                      </span>
                    </div>

                    {/* Items */}
                    <div className="grid gap-1.5">
                      {sec.items.map(item => {
                        const Icon      = item.icon;
                        const isActive  = activeTab === item.id;
                        const itemBadge = item.badgeKey ? badges[item.badgeKey] || 0 : 0;

                        return (
                          <button
                            key={item.id}
                            onClick={() => { setActiveTab(item.id); setActiveDropdown(null); }}
                            className={`w-full flex items-start gap-3.5 p-3 rounded-xl transition-all text-left cursor-pointer ${
                              isActive
                                ? item.isDanger
                                  ? 'bg-rose-50/90 text-rose-700 font-semibold border border-rose-200/70'
                                  : 'bg-blue-50/90 text-[#2259c2] font-semibold border border-blue-200/70'
                                : 'hover:bg-slate-50 text-slate-700 border border-transparent'
                            }`}
                          >
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                              isActive
                                ? item.isDanger
                                  ? 'bg-rose-600 text-white shadow-sm'
                                  : 'bg-[#2259c2] text-white shadow-sm'
                                : 'bg-slate-100 text-slate-600 border border-slate-200/50'
                            }`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-bold leading-snug flex items-center justify-between gap-2">
                                <span className={isActive ? (item.isDanger ? 'text-rose-700' : 'text-[#2259c2]') : 'text-slate-900'}>
                                  {item.label}
                                </span>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  {itemBadge > 0 && (
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                      item.isDanger ? 'bg-rose-500 text-white' : 'bg-blue-100 text-[#2259c2]'
                                    }`}>
                                      {itemBadge}
                                    </span>
                                  )}
                                  {isActive && <ArrowRight className={`w-4 h-4 ${item.isDanger ? 'text-rose-500' : 'text-[#2259c2]'}`} />}
                                </div>
                              </div>
                              <p className="text-xs text-slate-500 font-normal mt-1 leading-relaxed line-clamp-1">
                                {item.description}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      {/* ── MAIN CONTENT ──────────────────────────────────────────────── */}
      <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto space-y-6">
        {activeTab === 'overview'    && <OverviewPage setActiveTab={setActiveTab} />}
        {activeTab === 'manifest'    && <ManifestPage onInspectPassenger={handleInspectPassenger} />}
        {activeTab === 'scanner'     && (
          <ScannerPage initialPnr={scannerPrefillPnr} onIssueFinePrefill={handleIssueFinePrefill} />
        )}
        {activeTab === 'vacancies'   && <VacanciesPage />}
        {activeTab === 'fines'       && (
          <FinesPage
            prefillName={finePrefill?.name || ''}
            prefillIdRef={finePrefill?.idRef || ''}
            prefillReason={finePrefill?.reason || 'TICKETLESS_TRAVEL'}
          />
        )}
        {activeTab === 'operations'  && <OperationsPage />}
        {activeTab === 'crowd_clean' && <CrowdCleanPage />}
        {activeTab === 'emergency'   && <EmergencyPage />}
        {activeTab === 'counter'     && <CounterBookingPage />}
        {activeTab === 'maintenance' && <MaintenanceTasksPage />}
      </main>

      <ReceiptModal />
      <ToastContainer />
    </div>
  );
};
