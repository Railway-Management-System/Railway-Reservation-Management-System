import React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, ArrowLeft } from 'lucide-react';

export const PassengerPortalPage: React.FC = () => {
  return (
    <div className="fixed inset-0 flex flex-col h-screen w-screen bg-slate-900 text-slate-100 overflow-hidden font-sans">
      {/* Top Unified System Header */}
      <header className="h-14 bg-slate-950 border-b border-slate-800 px-4 sm:px-6 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Home</span>
          </Link>
          <div className="hidden sm:flex items-center gap-2 border-l border-slate-800 pl-3">
            <span className="text-xs font-semibold text-white">Passenger Portal</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
              RailConnect v1.0
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/user/index.html"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs border border-blue-500/30 transition-colors"
            title="Open Passenger portal in a separate tab"
          >
            <span>Open in Tab</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </header>

      {/* Embedded Passenger Application Frame - Exact Height, Zero Outer Scroll */}
      <div className="flex-1 min-h-0 w-full relative bg-slate-900 overflow-hidden">
        <iframe
          src="/user/index.html"
          title="Passenger Portal - RailConnect"
          className="w-full h-full border-none block"
          style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        />
      </div>
    </div>
  );
};

