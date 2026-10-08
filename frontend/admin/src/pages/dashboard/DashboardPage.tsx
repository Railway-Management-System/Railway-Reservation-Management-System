import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Ticket,
  DollarSign,
    Train,
  LifeBuoy,
  FileCheck2,
  AlertTriangle,
  Clock,
  ArrowRight,
    ShieldAlert,
} from 'lucide-react';
import { reportService } from '../../services/reportService';
import { bookingService } from '../../services/bookingService';
import { auditLogService } from '../../services/auditLogService';
import { scheduleService } from '../../services/scheduleService';
import { trainService } from '../../services/trainService';
import { DashboardMetrics } from '../../types/report';
import { Booking } from '../../types/booking';
import { AuditLog } from '../../types/auditLog';
import { Schedule } from '../../types/schedule';
import { Train as TrainType } from '../../types/train';
import { StatCard } from '../../components/StatCard';
import { StatusBadge } from '../../components/StatusBadge';
import { PageHeader } from '../../components/PageHeader';
import { formatCurrency, formatDateTime, formatDate,  } from '../../utils/format';
import { ADMIN_ROUTES } from '../../constants/routes';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [recentBookings, setRecentBookings] = useState<Booking[]>([]);
  const [recentAuditLogs, setRecentAuditLogs] = useState<AuditLog[]>([]);
  const [delayedSchedules, setDelayedSchedules] = useState<Schedule[]>([]);
  const [trainsMap, setTrainsMap] = useState<Map<number, TrainType>>(new Map());
  
  useEffect(() => {
    async function loadDashboard() {
      try {
        const [kpis, bookings, logs, schedules, trains] = await Promise.all([
          reportService.getDashboardMetrics(),
          bookingService.getBookings(),
          auditLogService.getAuditLogs(),
          scheduleService.getSchedules(),
          trainService.getTrains(),
        ]);

        setMetrics(kpis);
        setRecentBookings(bookings.slice(0, 5));
        setRecentAuditLogs(logs.slice(0, 5));
        setDelayedSchedules(schedules.filter((s) => s.status === 'DELAYED').slice(0, 4));
        setTrainsMap(new Map(trains.map((t) => [t.trainId, t])));
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
              }
    }
    loadDashboard();
  }, []);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Railway Operations Command Center"
        description="Real-time operational overview, booking transactions, fleet performance, and master auditing."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(ADMIN_ROUTES.BOOKINGS)}
              className="px-3.5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <Ticket className="w-4 h-4" />
              <span>Inspect Bookings</span>
            </button>
            <button
              onClick={() => navigate(ADMIN_ROUTES.SCHEDULES)}
              className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <Clock className="w-4 h-4 text-orange-600" />
              <span>Update Delays</span>
            </button>
          </div>
        }
      />

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Ticket Revenue"
          value={metrics ? formatCurrency(metrics.totalRevenue) : '—'}
          icon={DollarSign}
          color="emerald"
          change="+8.4% this week"
          isPositive={true}
          subtitle="Cleared passenger gateway settlements"
        />
        <StatCard
          title="Active System Bookings"
          value={metrics ? metrics.totalBookings : '—'}
          icon={Ticket}
          color="orange"
          subtitle="Tracked reservations across all trains"
        />
        <StatCard
          title="Active Train Services"
          value={metrics ? metrics.activeTrainsCount : '—'}
          icon={Train}
          color="blue"
          subtitle="Scheduled operational rakes"
        />
        <StatCard
          title="Delayed Train Runs"
          value={metrics ? metrics.delayedTrainsCount : '—'}
          icon={Clock}
          color="amber"
          subtitle="Live operational delay flags"
        />
      </div>

      {/* Second Row of KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          onClick={() => navigate(ADMIN_ROUTES.TDR)}
          className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-orange-300 cursor-pointer transition-all flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Pending TDR Claims</p>
              <p className="text-xl font-bold text-slate-900">{metrics?.pendingTdrCount ?? 0}</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400" />
        </div>

        <div
          onClick={() => navigate(ADMIN_ROUTES.GRIEVANCES)}
          className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-orange-300 cursor-pointer transition-all flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-amber-50 text-amber-600">
              <LifeBuoy className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Open Grievances</p>
              <p className="text-xl font-bold text-slate-900">{metrics?.openGrievancesCount ?? 0}</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400" />
        </div>

        <div
          onClick={() => navigate(ADMIN_ROUTES.INCIDENTS)}
          className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-orange-300 cursor-pointer transition-all flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-rose-50 text-rose-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Open Safety Incidents</p>
              <p className="text-xl font-bold text-slate-900">{metrics?.openIncidentsCount ?? 0}</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400" />
        </div>
      </div>

      {/* Main 2-Column Section: Recent Bookings & Delayed Runs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Bookings (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <Ticket className="w-5 h-5 text-orange-600" />
                <h3 className="font-bold text-slate-900 text-base">Recent Reservation Transactions</h3>
              </div>
              <button
                onClick={() => navigate(ADMIN_ROUTES.BOOKINGS)}
                className="text-xs font-semibold text-orange-600 hover:text-orange-700 flex items-center gap-1"
              >
                <span>View All Bookings</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {recentBookings.map((b) => {
                const train = trainsMap.get(b.trainId);
                return (
                  <div key={b.pnr} className="py-3.5 flex items-center justify-between hover:bg-slate-50/60 px-2 rounded-lg transition-colors">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900 text-sm">PNR {b.pnr}</span>
                        <StatusBadge status={b.bookingStatus} size="sm" />
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {train ? `${train.trainNumber} - ${train.trainName}` : `Train #${b.trainId}`} · Class {b.classType} ({b.quota})
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-slate-900 text-sm">{formatCurrency(b.totalFare)}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{formatDate(b.journeyDate)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span>Live transaction feed</span>
            <span className="font-mono">Auto-refreshed</span>
          </div>
        </div>

        {/* Operational Delay Snapshot (1 col) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-slate-900 text-base">Active Train Delays</h3>
              </div>
              <button
                onClick={() => navigate(ADMIN_ROUTES.SCHEDULES)}
                className="text-xs font-semibold text-orange-600 hover:text-orange-700"
              >
                Schedules →
              </button>
            </div>

            {delayedSchedules.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                All dated train runs are currently reported on schedule.
              </div>
            ) : (
              <div className="space-y-3">
                {delayedSchedules.map((s) => {
                  const train = trainsMap.get(s.trainId);
                  return (
                    <div key={s.scheduleId} className="p-3 rounded-lg border border-amber-200 bg-amber-50/50">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-900 text-xs truncate max-w-[160px]">
                          {train ? `${train.trainNumber} ${train.trainName}` : `Train #${s.trainId}`}
                        </span>
                        <span className="text-xs font-bold text-amber-700 font-mono">
                          +{s.delayMinutes} mins
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center justify-between">
                        <span>Run: {formatDate(s.journeyDate)}</span>
                        <StatusBadge status={s.status} size="sm" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100">
            <button
              onClick={() => navigate(ADMIN_ROUTES.SCHEDULES)}
              className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition-colors"
            >
              Manage Dated Schedules
            </button>
          </div>
        </div>
      </div>

      {/* Forensic Audit Log Preview */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-slate-700" />
            <h3 className="font-bold text-slate-900 text-base">Forensic Audit Activity Trail</h3>
          </div>
          <button
            onClick={() => navigate(ADMIN_ROUTES.AUDIT_LOGS)}
            className="text-xs font-semibold text-orange-600 hover:text-orange-700 flex items-center gap-1"
          >
            <span>Full Audit Trail</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="text-slate-400 uppercase tracking-wider border-b border-slate-100">
                <th className="py-2 font-semibold">Timestamp</th>
                <th className="py-2 font-semibold">Actor</th>
                <th className="py-2 font-semibold">Action</th>
                <th className="py-2 font-semibold">Entity</th>
                <th className="py-2 font-semibold">Target ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {recentAuditLogs.map((log) => (
                <tr key={log.auditId} className="hover:bg-slate-50/60">
                  <td className="py-2.5 font-mono text-slate-500">{formatDateTime(log.createdAt)}</td>
                  <td className="py-2.5 font-semibold text-slate-700">Admin #{log.userId}</td>
                  <td className="py-2.5">
                    <span className="font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-semibold">
                      {log.action}
                    </span>
                  </td>
                  <td className="py-2.5 text-slate-600">{log.entityType}</td>
                  <td className="py-2.5 font-mono font-medium text-slate-900">#{log.entityId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
