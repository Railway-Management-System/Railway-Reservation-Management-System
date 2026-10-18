import React, { useState, useEffect, useRef } from 'react';
import { useStaff } from '../context/StaffContext';
import { Search, Train, Clock, LogOut, ChevronDown, User, Badge, Home } from 'lucide-react';
import { authService } from '../admin/services/authService';

interface HeaderProps {
  onOpenScanner: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenScanner }) => {
  const { activeStaff, activeTrain } = useStaff();
  const [timeStr, setTimeStr] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

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
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => {
    authService.staffLogout();
    window.location.href = '/';
  };

  const initials = activeStaff.name
    ? activeStaff.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'TC';

  return (
    <header
      className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between"
      style={{ fontFamily: "'Inter', 'Plus Jakarta Sans', -apple-system, sans-serif" }}
    >
      {/* Left Area */}
      <div className="flex items-center gap-3">
        {/* Quick PNR Search */}
        <button
          onClick={onOpenScanner}
          className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:border-slate-300 text-xs font-medium transition-colors"
        >
          <Search className="w-3.5 h-3.5 text-slate-400" />
          <span>Quick PNR Search…</span>
        </button>

        {/* Active Train Pill */}
        {activeTrain ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-orange-200 bg-orange-50 text-orange-800 text-xs font-semibold">
            <Train className="w-3.5 h-3.5 text-orange-500" />
            <span className="font-bold text-orange-700 tracking-tight">#{activeTrain.trainNumber}</span>
            <span className="hidden md:inline text-orange-600 font-medium">
              — {activeTrain.trainName?.split(' ').slice(0, 3).join(' ')}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 text-xs font-medium">
            <Train className="w-3.5 h-3.5 text-slate-400" />
            <span>Station Master Duty</span>
          </div>
        )}
      </div>

      {/* Right Header Area */}
      <div className="flex items-center gap-2">
        {/* Back to Home */}
        <a
          href="/"
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors"
        >
          <Home className="w-3.5 h-3.5" />
          <span>Home</span>
        </a>

        {/* Live Clock */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono text-slate-600">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>{timeStr}</span>
        </div>

        {/* Divider */}
        <div className="hidden sm:block h-7 w-px bg-slate-200 mx-1" />

        {/* Profile Dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen((v) => !v)}
            className="flex items-center gap-2.5 pl-1 pr-3 py-1 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-orange-700 text-white font-bold flex items-center justify-center text-xs shadow-sm">
              {initials}
            </div>
            <div className="hidden lg:block text-left">
              <div className="text-xs font-semibold text-slate-800 leading-tight">{activeStaff.name}</div>
              <div className="text-[10px] text-orange-500 font-semibold leading-tight tracking-wide uppercase">
                {activeStaff.designation?.split(' ')[0] || 'Staff'}
              </div>
            </div>
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {/* Dropdown Panel */}
          {profileOpen && (
            <div
              className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200/80 z-[99999] overflow-hidden"
              style={{ boxShadow: '0 20px 60px -10px rgba(0,0,0,0.18), 0 4px 16px -4px rgba(0,0,0,0.10)' }}
            >
              {/* Profile Header */}
              <div className="px-5 py-4 bg-gradient-to-br from-orange-50 to-amber-50 border-b border-orange-100">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-orange-500 to-orange-700 text-white font-bold flex items-center justify-center text-sm shadow-md">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-900 text-sm leading-tight truncate">{activeStaff.name}</div>
                    <div className="text-xs text-orange-600 font-semibold mt-0.5">{activeStaff.designation}</div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">{activeStaff.employeeId}</div>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-1.5">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      activeStaff.status === 'ON_DUTY'
                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-500 border border-slate-200'
                    }`}
                  >
                    {activeStaff.status === 'ON_DUTY' ? '● ON DUTY' : '○ OFF DUTY'}
                  </span>
                  <span className="text-[10px] bg-orange-100 text-orange-700 border border-orange-200 font-semibold px-2 py-0.5 rounded-full">
                    {activeStaff.shift?.split('(')[1]?.replace(')', '') || 'Staff Terminal'}
                  </span>
                </div>
              </div>

              {/* Detail Rows */}
              <div className="px-4 py-3 space-y-2.5">
                <div className="flex items-center gap-2.5 text-xs">
                  <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <span className="text-slate-500 w-24">Employee ID</span>
                  <span className="font-mono font-semibold text-slate-800">{activeStaff.employeeId}</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs">
                  <Train className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <span className="text-slate-500 w-24">Assigned Train</span>
                  <span className="font-semibold text-slate-800">
                    {activeTrain ? `#${activeTrain.trainNumber}` : 'Station Duty'}
                  </span>
                </div>
                <div className="flex items-center gap-2.5 text-xs">
                  <Badge className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <span className="text-slate-500 w-24">Coaches</span>
                  <span className="font-semibold text-slate-800">
                    {activeStaff.assignedCoaches?.length ? activeStaff.assignedCoaches.join(', ') : 'All Coaches'}
                  </span>
                </div>
              </div>

              {/* Logout */}
              <div className="px-4 py-3 border-t border-slate-100">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out of Staff Terminal</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
