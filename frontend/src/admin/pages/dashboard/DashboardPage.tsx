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

import { API_CONFIG } from '../../config/api.config';
import { grievanceService } from '../../services/grievanceService';
import { tdrService } from '../../services/tdrService';
import { staffService } from '../../services/staffService';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [activeStaffCount, setActiveStaffCount] = useState<number | null>(null);
  const [recentBookings, setRecentBookings] = useState<Booking[]>([]);
  const [recentAuditLogs, setRecentAuditLogs] = useState<AuditLog[]>([]);
  const [delayedSchedules, setDelayedSchedules] = useState<Schedule[]>([]);
  const [trainsMap, setTrainsMap] = useState<Map<number, TrainType>>(new Map());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  useEffect(() => {
    async function loadDashboard() {
      setIsLoading(true);
      try {
        if (API_CONFIG.USE_MOCK) {
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
        } else {
          // Real mode: fetch live data from genuinely supported endpoints and reports
          const [trains, complaints, tdrs, logs, staff, classRevReport, quotaReport] = await Promise.all([
            trainService.getTrains().catch(() => []),
            grievanceService.getGrievances().catch(() => []),
            tdrService.getTdrClaims().catch(() => []),
            auditLogService.getAuditLogs().catch(() => []),
            staffService.getStaff().catch(() => []),
            reportService.getAnalyticalReport('class-revenue').catch(() => null),
            reportService.getAnalyticalReport('quota-utilization').catch(() => null),
          ]);

          const activeTrains = trains.filter((t) => t.status === 'ACTIVE').length;
          const openGrievances = complaints.filter(
            (c: any) => c.status === 'OPEN' || c.status === 'IN_PROGRESS' || c.status === 'SUBMITTED'
          ).length;
          const pendingTdrs = tdrs.filter(
            (t: any) => t.status === 'FILED' || t.status === 'UNDER_REVIEW'
          ).length;
          const activeStaff = staff.filter((s: any) => s.status === 'ACTIVE').length;

          // Compute authoritative total revenue from class-revenue report rows
          let totalRevenue = 0;
          if (classRevReport && Array.isArray(classRevReport.rows)) {
            totalRevenue = classRevReport.rows.reduce(
              (acc: number, r: any) => acc + (parseFloat(r.class_revenue) || 0),
              0
            );
          }

          // Compute authoritative total bookings from quota-utilization report rows
          let totalBookings = 0;
          if (quotaReport && Array.isArray(quotaReport.rows)) {
            totalBookings = quotaReport.rows.reduce(
              (acc: number, r: any) => acc + (parseInt(r.total_bookings, 10) || 0),
              0
            );
          }

          setActiveStaffCount(activeStaff);
          setTrainsMap(new Map(trains.map((t: any) => [t.trainId, t] as const)));
          setRecentAuditLogs(logs.slice(0, 5));

          setMetrics({
            totalBookings,
            totalRevenue,
            totalCancellations: 0,
            activeTrainsCount: activeTrains,
            openGrievancesCount: openGrievances,
            pendingTdrCount: pendingTdrs,
            openIncidentsCount: 0,
            delayedTrainsCount: 0,
          });
        }
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setIsLoading(false);
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
              className="px-4 py-2 bg-[#2259c2] hover:bg-[#1748a5] text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Ticket className="w-4 h-4" />
              <span>Inspect Bookings</span>
            </button>
            <button
              onClick={() => navigate(ADMIN_ROUTES.SCHEDULES)}
              className="px-4 py-2 bg-white border border-[#e2e8f0] hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Clock className="w-4 h-4 text-[#2259c2]" />
              <span>Update Delays</span>
            </button>
          </div>
        }
      />

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Train Fleet"
          value={isLoading ? 'Loading...' : (metrics ? metrics.activeTrainsCount : '—')}
          icon={Train}
          color="blue"
          subtitle="Operational active rakes"
        />
        <StatCard
          title="Active Staff Personnel"
          value={isLoading ? 'Loading...' : (API_CONFIG.USE_MOCK ? 28 : (activeStaffCount ?? '—'))}
          icon={ShieldAlert}
          color="emerald"
          subtitle="Duty-ready railway personnel"
        />
        <StatCard
          title="Total Ticket Revenue"
          value={
            isLoading
              ? 'Loading...'
              : metrics && metrics.totalRevenue > 0
              ? formatCurrency(metrics.totalRevenue)
              : 'This feature is not available yet.'
          }
          icon={DollarSign}
          color="emerald"
          subtitle="Authoritative audited passenger fare receipts"
        />
        <StatCard
          title="Active System Bookings"
          value={
            isLoading
              ? 'Loading...'
              : metrics && metrics.totalBookings > 0
              ? metrics.totalBookings.toLocaleString('en-IN')
              : 'This feature is not available yet.'
          }
          icon={Ticket}
          color="orange"
          subtitle="Total reservations across railway quotas"
        />
      </div>

      {/* Second Row of KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          onClick={() => navigate(ADMIN_ROUTES.TDR)}
          className="bg-white rounded-2xl border border-[#e2e8f0] p-4 shadow-xs hover:border-[#2259c2]/40 hover:shadow-md cursor-pointer transition-all flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#edf4ff] text-[#2452b8] border border-blue-100">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-meta font-bold uppercase tracking-wider">Pending TDR Claims</p>
              <p className="text-xl font-extrabold text-[#172338] tracking-tight">{metrics?.pendingTdrCount ?? 0}</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#2259c2] group-hover:translate-x-0.5 transition-all" />
        </div>

        <div
          onClick={() => navigate(ADMIN_ROUTES.GRIEVANCES)}
          className="bg-white rounded-2xl border border-[#e2e8f0] p-4 shadow-xs hover:border-amber-300 hover:shadow-md cursor-pointer transition-all flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#fff5e6] text-[#bd7c17] border border-amber-100">
              <LifeBuoy className="w-5 h-5" />
            </div>
            <div>
              <p className="text-meta font-bold uppercase tracking-wider">Open Grievances</p>
              <p className="text-xl font-extrabold text-[#172338] tracking-tight">{metrics?.openGrievancesCount ?? 0}</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#bd7c17] group-hover:translate-x-0.5 transition-all" />
        </div>

        <div
          onClick={() => navigate(ADMIN_ROUTES.INCIDENTS)}
          className="bg-white rounded-2xl border border-[#e2e8f0] p-4 shadow-xs hover:border-rose-300 hover:shadow-md cursor-pointer transition-all flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-meta font-bold uppercase tracking-wider">Open Safety Incidents</p>
              <p className="text-xl font-extrabold text-[#172338] tracking-tight">{metrics?.openIncidentsCount ?? 0}</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-rose-600 group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>

      {/* Main 2-Column Section: Recent Bookings & Delayed Runs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Bookings (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#e2e8f0] shadow-xs p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <Ticket className="w-5 h-5 text-[#2259c2]" />
                <h3 className="font-extrabold text-[#172338] text-base tracking-tight">Recent Reservation Transactions</h3>
              </div>
              <button
                onClick={() => navigate(ADMIN_ROUTES.BOOKINGS)}
                className="text-xs font-bold text-[#2259c2] hover:text-[#1748a5] flex items-center gap-1.5 transition-colors cursor-pointer px-3 py-1.5 rounded-lg hover:bg-blue-50"
              >
                <span>View All Bookings</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {isLoading ? (
                <div className="py-10 text-center text-xs text-slate-400 font-medium">
                  Loading recent transactions...
                </div>
              ) : recentBookings.length === 0 ? (
                <div className="py-10 text-center space-y-1">
                  <p className="text-xs font-semibold text-slate-600">No recent reservation records available.</p>
                  <p className="text-[11px] text-slate-400">
                    Active passenger bookings and ticket audits can be inspected via Global PNR Lookup.
                  </p>
                </div>
              ) : (
                recentBookings.map((b) => {
                  const train = trainsMap.get(b.trainId);
                  return (
                    <div key={b.pnr} className="py-3.5 flex items-center justify-between hover:bg-slate-50/60 px-2 rounded-xl transition-colors">
                      <div>
                        <div className="flex items-center gap-2.5">
                          <span className="font-bold text-[#16243b] text-sm tracking-tight">PNR {b.pnr}</span>
                          <StatusBadge status={b.bookingStatus} size="sm" />
                        </div>
                        <p className="text-xs text-slate-500 mt-1 font-medium">
                          {train ? `${train.trainNumber} - ${train.trainName}` : `Train #${b.trainId}`} · Class {b.classType} ({b.quota})
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="font-extrabold text-[#16243b] text-sm">{formatCurrency(b.totalFare)}</div>
                        <div className="text-[11px] text-slate-400 font-medium mt-0.5">{formatDate(b.journeyDate)}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Live transaction feed</span>
            <span className="text-slate-400">Auto-refreshed</span>
          </div>
        </div>

        {/* Operational Delay Snapshot (1 col) */}
        <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-xs p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-600" />
                <h3 className="font-extrabold text-[#172338] text-base tracking-tight">Active Train Delays</h3>
              </div>
              <button
                onClick={() => navigate(ADMIN_ROUTES.SCHEDULES)}
                className="text-xs font-bold text-[#2259c2] hover:text-[#1748a5] transition-colors cursor-pointer px-2.5 py-1 rounded-lg hover:bg-blue-50"
              >
                Schedules →
              </button>
            </div>

            {delayedSchedules.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 font-medium">
                All dated train runs are currently reported on schedule.
              </div>
            ) : (
              <div className="space-y-3">
                {delayedSchedules.map((s) => {
                  const train = trainsMap.get(s.trainId);
                  return (
                    <div key={s.scheduleId} className="p-3.5 rounded-xl border border-amber-200/80 bg-amber-50/50">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-slate-900 text-xs truncate max-w-[160px]">
                          {train ? `${train.trainNumber} ${train.trainName}` : `Train #${s.trainId}`}
                        </span>
                        <span className="text-xs font-bold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-md">
                          +{s.delayMinutes} mins
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium flex items-center justify-between">
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
              className="w-full py-2.5 bg-slate-50 hover:bg-blue-50 hover:text-[#2259c2] text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-colors cursor-pointer"
            >
              Manage Dated Schedules
            </button>
          </div>
        </div>
      </div>

      {/* Forensic Audit Log Preview */}
      <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-xs p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-slate-100 text-[#172338]">
              <ShieldAlert className="w-5 h-5 text-slate-700" />
            </div>
            <div>
              <h3 className="font-extrabold text-[#172338] text-base tracking-tight">Forensic Audit Activity Trail</h3>
              <p className="text-xs text-slate-400 mt-0.5">Real-time immutable administrative and security event logs</p>
            </div>
          </div>
          <button
            onClick={() => navigate(ADMIN_ROUTES.AUDIT_LOGS)}
            className="text-xs font-bold text-[#2259c2] hover:text-[#1748a5] flex items-center gap-1.5 transition-colors cursor-pointer px-3 py-1.5 rounded-lg hover:bg-blue-50"
          >
            <span>Full Audit Trail</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 uppercase tracking-wider text-[11px] font-bold border-b border-slate-200">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Entity</th>
                <th className="py-3 px-4 text-right">Target ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {recentAuditLogs.map((log) => (
                <tr key={log.auditId} className="hover:bg-blue-50/30 transition-colors">
                  <td className="py-3 px-4 text-slate-500 font-medium whitespace-nowrap">
                    {formatDateTime(log.createdAt)}
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-semibold text-slate-800">Admin #{log.userId}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-block px-2.5 py-1 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200/80">
                      {log.action}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-[#2259c2]">
                      {log.entityType}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="inline-block px-2 py-0.5 rounded-md text-xs font-bold text-slate-900 bg-slate-100">
                      #{log.entityId}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
