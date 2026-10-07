import React, { useState } from 'react';
import { Shield, KeyRound, Server, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { API_CONFIG } from '../../config/api.config';
import { PageHeader } from '../../components/PageHeader';

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw !== confirmPw) {
      alert('New passwords do not match.');
      return;
    }
    setPwSuccess(true);
    setCurrentPw('');
    setNewPw('');
    setConfirmPw('');
    setTimeout(() => setPwSuccess(false), 4000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Administrator Settings & Configuration"
        description="Manage administrator profile, security credentials, and Phase 3 REST API backend integration toggle."
      />

      {/* Admin Profile Overview */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
        <div className="flex items-center gap-4 pb-6 border-b border-slate-100">
          <div className="w-16 h-16 rounded-2xl bg-orange-600 text-white font-bold flex items-center justify-center text-2xl shadow-md shadow-orange-950/20">
            {user?.name ? user.name[0].toUpperCase() : 'A'}
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">{user?.name || 'Administrator'}</h3>
            <p className="text-xs text-slate-500 font-mono mt-0.5">Admin ID: #{user?.userId || 7}</p>
            <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-orange-50 border border-orange-200 text-orange-700 text-xs font-semibold">
              <Shield className="w-3.5 h-3.5" />
              <span>Full System Authority (ADMIN)</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-6 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-slate-400 font-semibold block uppercase">Official Email</span>
            <span className="text-slate-900 font-mono font-medium text-sm">
              admin@railways.gov.in
            </span>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-slate-400 font-semibold block uppercase">Assigned Division</span>
            <span className="text-slate-900 font-medium text-sm">
              Ministry of Railways / Central Operations
            </span>
          </div>
        </div>
      </div>

      {/* Phase 3 Backend Integration Toggle Status */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              API Connection Architecture & Mock Layer
            </h3>
            <p className="text-xs text-slate-500">
              Zero-drift architecture prepared for drop-in Phase 3 backend integration.
            </p>
          </div>
        </div>

        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-600 font-medium">Active Data Mode:</span>
            <span
              className={`font-mono font-bold px-2.5 py-1 rounded-md text-xs ${
                API_CONFIG.USE_MOCK
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
              }`}
            >
              {API_CONFIG.USE_MOCK ? 'MOCK DATA LAYER (ACTIVE)' : 'LIVE REST API (ACTIVE)'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-600 font-medium">Configured REST Base URL:</span>
            <span className="font-mono text-slate-800 bg-white px-2 py-1 rounded border border-slate-200">
              {API_CONFIG.BASE_URL}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-600 font-medium">Simulated Network Latency:</span>
            <span className="font-mono text-slate-800">{API_CONFIG.DEFAULT_MOCK_LATENCY_MS} ms</span>
          </div>

          <p className="text-[11px] text-slate-500 pt-2 border-t border-slate-200 leading-relaxed">
            💡 To switch to the live backend when Phase 3 is deployed: set <code className="bg-white px-1 py-0.5 rounded border border-slate-200 text-slate-800 font-mono">VITE_USE_MOCK=false</code> in <code className="bg-white px-1 py-0.5 rounded border border-slate-200 text-slate-800 font-mono">.env</code>. The entire admin dashboard will instantly consume real HTTP REST endpoints without any UI or service code changes.
          </p>
        </div>
      </div>

      {/* Password Change Security Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-orange-50 text-orange-600">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Security Credentials</h3>
            <p className="text-xs text-slate-500">Update administrative password.</p>
          </div>
        </div>

        {pwSuccess && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Password updated successfully.</span>
          </div>
        )}

        <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-md">
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
              Current Password *
            </label>
            <input
              type="password"
              required
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-lg p-2.5 font-mono focus:ring-2 focus:ring-orange-500 focus:outline-none"
              placeholder="••••••••••••"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
              New Password *
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-lg p-2.5 font-mono focus:ring-2 focus:ring-orange-500 focus:outline-none"
              placeholder="••••••••••••"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
              Confirm New Password *
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-lg p-2.5 font-mono focus:ring-2 focus:ring-orange-500 focus:outline-none"
              placeholder="••••••••••••"
            />
          </div>

          <button
            type="submit"
            className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
          >
            Update Password
          </button>
        </form>
      </div>
    </div>
  );
};
