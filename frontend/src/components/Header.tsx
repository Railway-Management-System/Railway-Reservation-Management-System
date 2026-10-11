import React, { useState, useEffect } from 'react';
import { useStaff } from '../context/StaffContext';
import { Search, Train, Clock, ExternalLink } from 'lucide-react';

interface HeaderProps {
  onOpenScanner: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenScanner }) => {
  const { activeStaff, activeTrain } = useStaff();
  const [timeStr, setTimeStr] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTimeStr(now.toLocaleDateString('en-GB') + ' ' + now.toLocaleTimeString('en-US', { hour12: false }));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between">
      {/* Left Area */}
      <div className="flex items-center gap-3">
        {/* Quick PNR Search Trigger Button - Matching Admin */}
        <button
          onClick={onOpenScanner}
          className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:border-slate-300 text-xs transition-colors"
        >
          <Search className="w-3.5 h-3.5 text-slate-400" />
          <span>Quick PNR Search...</span>
          <kbd className="hidden md:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-white border border-slate-200 rounded text-slate-400 shadow-2xs">
            Ctrl+K
          </kbd>
        </button>

        {/* Active Train Assignment Pill */}
        {activeTrain ? (
          <div className="flex items-center gap-2 px-3 py-1 rounded-lg border border-orange-200 bg-orange-50 text-orange-800 text-xs font-medium">
            <Train className="w-3.5 h-3.5 text-orange-600" />
            <span className="font-mono font-bold text-orange-700">Train #{activeTrain.trainNumber}</span>
            <span className="hidden md:inline text-orange-600">({activeStaff.assignedCoaches.join(', ') || 'All'})</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-xs font-medium">
            <Train className="w-3.5 h-3.5 text-slate-500" />
            <span>Station Master Duty</span>
          </div>
        )}
      </div>

      {/* Right Header Area */}
      <div className="flex items-center gap-3">
        {/* Portal Cross-Link: Jump to Admin */}
        <a
          href="http://localhost:5173"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors"
          title="Open Admin Portal"
        >
          <span>Admin Portal</span>
          <ExternalLink className="w-3 h-3 text-slate-400" />
        </a>

        {/* Live Clock Display */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono text-slate-600">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>{timeStr}</span>
        </div>

        {/* Officer Avatar Badge - Matching Admin Profile Badge */}
        <div className="flex items-center gap-2 pl-2 sm:border-l sm:border-slate-200">
          <div className="w-8 h-8 rounded-full bg-orange-600 text-white font-bold flex items-center justify-center text-xs shadow-xs">
            {activeStaff.name ? activeStaff.name[0].toUpperCase() : 'T'}
          </div>
          <div className="hidden lg:block text-left">
            <div className="text-xs font-semibold text-slate-800 leading-tight">{activeStaff.name}</div>
            <div className="text-[10px] text-slate-500 font-mono leading-tight">{activeStaff.designation.split(' ')[0]}</div>
          </div>
        </div>
      </div>
    </header>
  );
};
