import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  Train,
  Route,
  Calendar,
  Building2,
  Layers,
  Armchair,
  DollarSign,
  PieChart,
  Ticket,
  FileCheck2,
  AlertOctagon,
  LifeBuoy,
  BarChart3,
  History,
  Bell,
  Settings,
  LogOut,
  Search,
  Menu,
  X,
  ChevronDown,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { ADMIN_ROUTES } from '../constants/routes';
import { notificationService } from '../services/notificationService';
import { GlobalPnrSearchModal } from '../components/GlobalPnrSearchModal';

interface NavItem {
  label: string;
  path: string;
  description: string;
  icon: React.ElementType;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export const AdminLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [pnrSearchOpen, setPnrSearchOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  const navRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close menus on route change
  useEffect(() => {
    setActiveDropdown(null);
    setMobileMenuOpen(false);
    setProfileDropdownOpen(false);
  }, [location.pathname]);

  // Load unread notifications
  useEffect(() => {
    notificationService
      .getNotifications()
      .then((notifs) => {
        setUnreadNotifications(notifs.filter((n) => !n.isRead).length);
      })
      .catch(() => {});
  }, [location.pathname]);

  const navSections: NavSection[] = [
    {
      title: 'Users & Personnel',
      items: [
        { label: 'Passenger Accounts', path: ADMIN_ROUTES.USERS, description: 'User registry, KYC and profiles', icon: Users },
        { label: 'Staff & Conductors', path: ADMIN_ROUTES.STAFF, description: 'Duty rosters, TCs and field personnel', icon: ShieldCheck },
      ],
    },
    {
      title: 'Trains & Routes',
      items: [
        { label: 'Train Master', path: ADMIN_ROUTES.TRAINS, description: 'Train fleet, classes and configurations', icon: Train },
        { label: 'Route Stops', path: ADMIN_ROUTES.ROUTES, description: 'Station sequences, halts and distances', icon: Route },
        { label: 'Schedules', path: ADMIN_ROUTES.SCHEDULES, description: 'Timetables, run dates and delay logs', icon: Calendar },
        { label: 'Stations Master', path: ADMIN_ROUTES.STATIONS, description: 'Station codes, divisions and zones', icon: Building2 },
        { label: 'Platforms & Tracks', path: ADMIN_ROUTES.PLATFORMS, description: 'Platform allocation and track occupancy', icon: Layers },
      ],
    },
    {
      title: 'Coaches & Fares',
      items: [
        { label: 'Coaches Master', path: ADMIN_ROUTES.COACHES, description: 'Rake compositions and coach tiers', icon: Layers },
        { label: 'Seats & Berths', path: ADMIN_ROUTES.SEATS, description: 'Seat matrices and layout maps', icon: Armchair },
        { label: 'Fares & Dynamic Pricing', path: ADMIN_ROUTES.FARES, description: 'Base tariffs, distance slabs and tatkal', icon: DollarSign },
        { label: 'Quota Rules', path: ADMIN_ROUTES.QUOTAS, description: 'General, Ladies, Senior, Tatkal quotas', icon: PieChart },
      ],
    },
    {
      title: 'Operations',
      items: [
        { label: 'Reservations & PNR', path: ADMIN_ROUTES.BOOKINGS, description: 'PNR ledger, tickets and statuses', icon: Ticket },
        { label: 'TDR Adjudication', path: ADMIN_ROUTES.TDR, description: 'Ticket deposit refunds and claims', icon: FileCheck2 },
        { label: 'Fines & Penalties', path: ADMIN_ROUTES.FINES, description: 'TC on-spot fines and unauthorized travel', icon: DollarSign },
        { label: 'Incidents & SOS', path: ADMIN_ROUTES.INCIDENTS, description: 'Safety dispatches and operational alerts', icon: AlertOctagon },
        { label: 'Grievances', path: ADMIN_ROUTES.GRIEVANCES, description: 'Passenger support and rail madad complaints', icon: LifeBuoy },
      ],
    },
    {
      title: 'Analytics & Logs',
      items: [
        { label: 'Operational Reports', path: ADMIN_ROUTES.REPORTS, description: 'Occupancy, revenue and delay analytics', icon: BarChart3 },
        { label: 'Forensic Audit Logs', path: ADMIN_ROUTES.AUDIT_LOGS, description: 'Admin change trail and security records', icon: History },
      ],
    },
    {
      title: 'System',
      items: [
        { label: 'Broadcast Alerts', path: ADMIN_ROUTES.NOTIFICATIONS, description: 'Passenger and staff push broadcasts', icon: Bell },
        { label: 'System Configuration', path: ADMIN_ROUTES.SETTINGS, description: 'Global parameters and mock toggles', icon: Settings },
      ],
    },
  ];

  const handleLogout = () => {
    logout();
    navigate(ADMIN_ROUTES.LOGIN);
  };

  // Find which category and item is currently active based on current path
  const currentSection = navSections.find((sec) =>
    sec.items.some((item) => location.pathname === item.path || location.pathname.startsWith(item.path + '/'))
  );
  const currentItem = currentSection?.items.find(
    (item) => location.pathname === item.path || location.pathname.startsWith(item.path + '/')
  );

  const isDashboardActive = location.pathname === ADMIN_ROUTES.DASHBOARD;

  return (
    <div
      className="min-h-screen bg-[#f5f7fb] flex flex-col text-[#172338]"
      style={{ fontFamily: "'Inter', 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}
    >
      {/* ── 1. PRIMARY SYSTEM TOPBAR ─────────────────────────────────── */}
      <header className="h-[72px] px-4 sm:px-8 bg-white border-b border-[#e9edf4] flex items-center justify-between sticky top-0 z-[100] shadow-xs">
        {/* Left: Clean Brand */}
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-3 group">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md shadow-blue-900/15 transition-transform group-hover:scale-105"
              style={{ background: '#2259c2' }}
            >
              <Train className="w-5 h-5 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-bold text-sm sm:text-[15px] tracking-tight text-[#16243b]">
                Railway Reservation
              </div>
              <div className="text-[12px] font-semibold text-[#2259c2] mt-0.5">
                Admin Console
              </div>
            </div>
          </Link>
        </div>

        {/* Center: Clean Search bar (balanced size with brand) */}
        <div className="hidden md:flex items-center flex-1 max-w-lg mx-6 lg:mx-10">
          <button
            type="button"
            onClick={() => setPnrSearchOpen(true)}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] text-[13px] text-[#64748b] hover:border-[#cbd5e1] hover:bg-white hover:shadow-sm transition-all shadow-xs cursor-pointer"
          >
            <Search className="w-4 h-4 text-[#2259c2]" />
            <span className="font-medium text-slate-500">Search PNR, train number, or passenger...</span>
          </button>
        </div>

        {/* Right: Cross-portal Navigation, Notifications & Profile */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Sister portals */}
          <Link
            to="/passenger"
            className="hidden lg:flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-[#2259c2] bg-blue-50 hover:bg-blue-100 transition-colors"
          >
            <span>Passenger Portal</span>
          </Link>
          <Link
            to="/staff"
            className="hidden lg:flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-orange-700 bg-orange-50 hover:bg-orange-100 transition-colors"
          >
            <Train className="w-4 h-4 text-orange-600" />
            <span>Staff Terminal</span>
          </Link>

          {/* Notification Bell */}
          <button
            onClick={() => navigate(ADMIN_ROUTES.NOTIFICATIONS)}
            className="relative p-2.5 rounded-xl text-[#526078] hover:bg-[#f3f5f9] hover:text-[#1d4fae] transition-colors cursor-pointer"
            title="Notifications"
          >
            <Bell className="w-[18px] h-[18px]" />
            {unreadNotifications > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#ef4444] text-[9px] font-bold text-white flex items-center justify-center shadow-xs">
                {unreadNotifications}
              </span>
            )}
          </button>

          {/* Clean Admin Profile Pill (Slightly larger, balanced with brand) */}
          <div className="relative" ref={profileRef} style={{ zIndex: 9999 }}>
            <button
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              className="flex items-center gap-3 px-2 py-1.5 rounded-xl hover:bg-[#f3f5f9] transition-all cursor-pointer group"
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[13px] font-bold shadow-xs transition-transform group-hover:scale-105"
                style={{ background: '#2259c2' }}
              >
                {user?.name ? user.name[0].toUpperCase() : 'A'}
              </div>
              <div className="hidden sm:flex flex-col text-left leading-tight">
                <span className="text-[13px] font-bold text-[#16243b]">
                  {user?.name || 'Rajesh Gupta'}
                </span>
                <span className="text-[11px] font-medium text-slate-500">
                  {user?.role || 'Administrator'}
                </span>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 hidden sm:block ml-0.5" />
            </button>

            {profileDropdownOpen && (
              <div
                className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-[0_20px_50px_rgba(15,23,42,0.18)] border border-[#e2e8f0] py-2.5"
                style={{ zIndex: 99999 }}
              >
                <div className="px-4 py-3 border-b border-[#f1f5f9]">
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-xs"
                      style={{ background: '#2259c2' }}
                    >
                      {user?.name ? user.name[0].toUpperCase() : 'A'}
                    </div>
                    <div className="leading-tight">
                      <p className="text-sm font-bold text-[#0f172a]">{user?.name || 'Rajesh Gupta'}</p>
                      <p className="text-xs text-slate-500 font-medium truncate">admin@railways.gov.in</p>
                    </div>
                  </div>
                  <span className="inline-block px-2.5 py-1 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200/60">
                    Role: {user?.role || 'ADMIN'}
                  </span>
                </div>
                <div className="py-1.5">
                  <NavLink
                    to={ADMIN_ROUTES.SETTINGS}
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-[13px] text-slate-700 hover:bg-slate-50 hover:text-[#2259c2] font-semibold transition-colors"
                  >
                    <Settings className="w-4 h-4 text-slate-500" />
                    System Settings
                  </NavLink>
                  <NavLink
                    to={ADMIN_ROUTES.AUDIT_LOGS}
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-[13px] text-slate-700 hover:bg-slate-50 hover:text-[#2259c2] font-semibold transition-colors"
                  >
                    <History className="w-4 h-4 text-slate-500" />
                    Forensic Audit Logs
                  </NavLink>
                </div>
                <div className="pt-1.5 border-t border-[#f1f5f9]">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-rose-600 hover:bg-rose-50 font-bold cursor-pointer transition-colors"
                  >
                    <LogOut className="w-4 h-4 text-rose-500" />
                    Log Out of Console
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
            aria-label="Toggle navigation"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* ── 2. HORIZONTAL NAVIGATION BAR WITH DROPDOWNS (MAIN HEADINGS) ── */}
      <nav
        ref={navRef}
        className="bg-white border-b border-[#e5e9f1] px-4 sm:px-8 relative z-50 shadow-2xs"
      >
        <div className="flex items-center gap-1.5 sm:gap-2.5 flex-wrap py-1.5 relative">
          {/* Dashboard Direct Tab */}
          <NavLink
            to={ADMIN_ROUTES.DASHBOARD}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
              isDashboardActive
                ? 'text-[#2259c2] bg-blue-50/80 shadow-2xs'
                : 'text-[#475569] hover:text-[#0f172a] hover:bg-slate-50'
            }`}
          >
            <LayoutDashboard className={`w-4 h-4 ${isDashboardActive ? 'text-[#2259c2]' : 'text-slate-500'}`} />
            <span>Dashboard</span>
          </NavLink>

          {/* Dropdown Navigation Tabs for each Main Section */}
          {navSections.map((sec) => {
            const isSecActive = currentSection?.title === sec.title;
            const isOpen = activeDropdown === sec.title;

            return (
              <div key={sec.title} className="relative">
                <button
                  type="button"
                  onClick={() => setActiveDropdown(isOpen ? null : sec.title)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
                    isSecActive
                      ? 'text-[#2259c2] bg-blue-50/80 shadow-2xs'
                      : isOpen
                      ? 'text-[#0f172a] bg-slate-100'
                      : 'text-[#475569] hover:text-[#0f172a] hover:bg-slate-50'
                  }`}
                >
                  <span>{sec.title}</span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-[#2259c2]' : isSecActive ? 'text-[#2259c2]' : 'text-slate-400'
                    }`}
                  />
                </button>

                {/* Suboptions Dropdown Panel (Elevated over entire page with spacious readable typography) */}
                {isOpen && (
                  <div
                    className="absolute left-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-[0_24px_70px_rgba(15,23,42,0.20)] border border-[#e2e8f0] p-2.5 animate-in fade-in zoom-in-95"
                    style={{ zIndex: 9999 }}
                  >
                    <div className="px-3.5 py-2.5 mb-1.5 border-b border-slate-100 flex items-center justify-between">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                        {sec.title} Submodules
                      </span>
                      <span className="text-xs text-[#2259c2] font-bold bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200/50">
                        {sec.items.length} views
                      </span>
                    </div>

                    <div className="grid gap-1.5">
                      {sec.items.map((item) => {
                        const Icon = item.icon;
                        const isCurrentItem = location.pathname === item.path || location.pathname.startsWith(item.path + '/');

                        return (
                          <NavLink
                            key={item.path}
                            to={item.path}
                            onClick={() => setActiveDropdown(null)}
                            className={`flex items-start gap-3.5 p-3 rounded-xl transition-all ${
                              isCurrentItem
                                ? 'bg-blue-50/90 text-[#1d4fae] font-semibold border border-blue-200/70'
                                : 'hover:bg-slate-50 text-slate-700 border border-transparent'
                            }`}
                          >
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                                isCurrentItem
                                  ? 'bg-[#2259c2] text-white shadow-xs'
                                  : 'bg-slate-100 text-slate-600 group-hover:bg-white border border-slate-200/50'
                              }`}
                            >
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-bold leading-snug flex items-center justify-between">
                                <span className={isCurrentItem ? 'text-[#2259c2]' : 'text-slate-900'}>
                                  {item.label}
                                </span>
                                {isCurrentItem && (
                                  <ArrowRight className="w-4 h-4 text-[#2259c2]" />
                                )}
                              </div>
                              <p className="text-xs text-slate-500 font-normal mt-1 leading-relaxed line-clamp-1">
                                {item.description}
                              </p>
                            </div>
                          </NavLink>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Mobile Accordion Nav Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-3 border-t border-slate-100 space-y-3">
            {navSections.map((sec) => (
              <div key={sec.title} className="space-y-1">
                <div className="text-meta font-bold uppercase tracking-wider px-2">
                  {sec.title}
                </div>
                <div className="grid grid-cols-1 gap-1">
                  {sec.items.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <item.icon className="w-3.5 h-3.5 text-blue-600" />
                      <span>{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </nav>



      {/* ── 4. MAIN PAGE DATA CONTAINER (EXPANDED TO FULL VIEWPORT WIDTH) ── */}
      <main className="flex-1 w-full px-4 sm:px-8 py-6">
        <div className="w-full">
          <Outlet />
        </div>
      </main>

      {/* Global PNR Search Modal */}
      <GlobalPnrSearchModal
        isOpen={pnrSearchOpen}
        onClose={() => setPnrSearchOpen(false)}
      />
    </div>
  );
};
