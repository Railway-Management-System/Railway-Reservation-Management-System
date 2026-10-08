import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
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
  } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { ADMIN_ROUTES } from '../constants/routes';
import { notificationService } from '../services/notificationService';
import { GlobalPnrSearchModal } from '../components/GlobalPnrSearchModal';

interface NavItem {
  label: string;
  path: string;
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

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [pnrSearchOpen, setPnrSearchOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  // Load unread notifications
  useEffect(() => {
    notificationService.getNotifications().then((notifs) => {
      setUnreadNotifications(notifs.filter((n) => !n.isRead).length);
    }).catch(() => {});
  }, [location.pathname]);

  const navSections: NavSection[] = [
    {
      title: 'OVERVIEW',
      items: [
        { label: 'Dashboard', path: ADMIN_ROUTES.DASHBOARD, icon: LayoutDashboard },
      ],
    },
    {
      title: 'USERS & PERSONNEL',
      items: [
        { label: 'Passengers', path: ADMIN_ROUTES.USERS, icon: Users },
        { label: 'Staff / TC', path: ADMIN_ROUTES.STAFF, icon: ShieldCheck },
      ],
    },
    {
      title: 'TRAINS & INFRASTRUCTURE',
      items: [
        { label: 'Train Master', path: ADMIN_ROUTES.TRAINS, icon: Train },
        { label: 'Route Stops', path: ADMIN_ROUTES.ROUTES, icon: Route },
        { label: 'Schedules', path: ADMIN_ROUTES.SCHEDULES, icon: Calendar },
        { label: 'Stations', path: ADMIN_ROUTES.STATIONS, icon: Building2 },
        { label: 'Platforms', path: ADMIN_ROUTES.PLATFORMS, icon: Layers },
      ],
    },
    {
      title: 'COACH, FARE & QUOTA',
      items: [
        { label: 'Coaches', path: ADMIN_ROUTES.COACHES, icon: Layers },
        { label: 'Seats & Layouts', path: ADMIN_ROUTES.SEATS, icon: Armchair },
        { label: 'Fares & Calculator', path: ADMIN_ROUTES.FARES, icon: DollarSign },
        { label: 'Quota Rules', path: ADMIN_ROUTES.QUOTAS, icon: PieChart },
      ],
    },
    {
      title: 'OPERATIONS',
      items: [
        { label: 'Reservations & PNR', path: ADMIN_ROUTES.BOOKINGS, icon: Ticket },
        { label: 'TDR Adjudication', path: ADMIN_ROUTES.TDR, icon: FileCheck2 },
        { label: 'Fines & Penalties', path: ADMIN_ROUTES.FINES, icon: DollarSign },
        { label: 'Incidents & Safety', path: ADMIN_ROUTES.INCIDENTS, icon: AlertOctagon },
        { label: 'Grievances', path: ADMIN_ROUTES.GRIEVANCES, icon: LifeBuoy },
      ],
    },
    {
      title: 'ANALYTICS & AUDIT',
      items: [
        { label: 'Operational Reports', path: ADMIN_ROUTES.REPORTS, icon: BarChart3 },
        { label: 'Forensic Audit Logs', path: ADMIN_ROUTES.AUDIT_LOGS, icon: History },
      ],
    },
    {
      title: 'SYSTEM',
      items: [
        { label: 'Notifications', path: ADMIN_ROUTES.NOTIFICATIONS, icon: Bell },
        { label: 'Settings', path: ADMIN_ROUTES.SETTINGS, icon: Settings },
      ],
    },
  ];

  const handleLogout = () => {
    logout();
    navigate(ADMIN_ROUTES.LOGIN);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden backdrop-blur-xs"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-slate-900 text-slate-300 flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 px-6 flex items-center justify-between border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-600 flex items-center justify-center text-white font-bold shadow-md shadow-orange-950/50">
              <Train className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-white text-base tracking-tight leading-none">
                RRMS Admin
              </div>
              <div className="text-[11px] text-orange-400 font-semibold tracking-wide uppercase mt-1">
                Railway Operations
              </div>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6 scrollbar-thin">
          {navSections.map((section, sIdx) => (
            <div key={sIdx}>
              <div className="px-3 mb-2 text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                {section.title}
              </div>
              <div className="space-y-1">
                {section.items.map((item, iIdx) => {
                  const Icon = item.icon;
                  const isActive =
                    item.path === ADMIN_ROUTES.DASHBOARD
                      ? location.pathname === ADMIN_ROUTES.DASHBOARD
                      : location.pathname.startsWith(item.path);

                  return (
                    <NavLink
                      key={iIdx}
                      to={item.path}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-orange-600 text-white shadow-sm font-semibold'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* User Card in Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/30">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-orange-700/80 text-white font-bold flex items-center justify-center text-sm border border-orange-500/30">
              {user?.name ? user.name[0].toUpperCase() : 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user?.name || 'Admin'}</p>
              <p className="text-[11px] text-orange-400 font-mono">Role: {user?.role || 'ADMIN'}</p>
            </div>
            <button
              onClick={handleLogout}
              title="Logout"
              className="text-slate-400 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:pl-72 min-w-0">
        {/* Top Navbar */}
        <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Quick PNR Search Trigger Button */}
            <button
              onClick={() => setPnrSearchOpen(true)}
              className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:border-slate-300 text-xs transition-colors"
            >
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span>Quick PNR Search...</span>
              <kbd className="hidden md:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-white border border-slate-200 rounded text-slate-400 shadow-2xs">
                Ctrl+K
              </kbd>
            </button>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPnrSearchOpen(true)}
              className="sm:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
              title="Quick PNR Search"
            >
              <Search className="w-5 h-5" />
            </button>

            {/* Notification Bell */}
            <button
              onClick={() => navigate(ADMIN_ROUTES.NOTIFICATIONS)}
              className="relative p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadNotifications > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-orange-600 text-[10px] font-bold text-white flex items-center justify-center shadow-xs">
                  {unreadNotifications}
                </span>
              )}
            </button>

            {/* Admin Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-orange-600 text-white font-bold flex items-center justify-center text-xs shadow-xs">
                  {user?.name ? user.name[0].toUpperCase() : 'A'}
                </div>
                <span className="hidden md:inline text-xs font-semibold text-slate-700">
                  {user?.name || 'Administrator'}
                </span>
                <ChevronDown className="w-4 h-4 text-slate-400 hidden md:inline" />
              </button>

              {profileDropdownOpen && (
                <div
                  className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1 text-sm z-50 animate-in fade-in zoom-in-95"
                  onClick={() => setProfileDropdownOpen(false)}
                >
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="font-semibold text-slate-800 text-xs">{user?.name}</p>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">Role: ADMIN</p>
                  </div>
                  <NavLink
                    to={ADMIN_ROUTES.SETTINGS}
                    className="block px-4 py-2 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    Admin Profile & Settings
                  </NavLink>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 font-medium"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content Container */}
        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Global PNR Search Modal */}
      <GlobalPnrSearchModal
        isOpen={pnrSearchOpen}
        onClose={() => setPnrSearchOpen(false)}
      />
    </div>
  );
};
