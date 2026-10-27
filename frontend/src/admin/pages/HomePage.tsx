import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  MapPin, ArrowRightLeft, Calendar, Users, User,
  EyeOff, Eye, AlertCircle, Train, ArrowRight
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { authService } from '../services/authService';
import { ADMIN_ROUTES } from '../constants/routes';

export default function HomePage() {
  const [selectedRole, setSelectedRole] = useState<'Admin' | 'Staff' | 'Passenger'>('Passenger');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Train Search Form states
  const [fromStation, setFromStation] = useState('');
  const [toStation, setToStation] = useState('');
  const [journeyDate, setJourneyDate] = useState('');
  const [journeyClass, setJourneyClass] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();

  // Clear any stale sessions on home page load — forces re-login every visit
  useEffect(() => {
    authService.logout();
    authService.staffLogout();
  }, []);

  const handleRoleSelect = (role: 'Admin' | 'Staff' | 'Passenger') => {
    setSelectedRole(role);
    setError(null);
    if (role === 'Admin') {
      setEmail('admin@railways.gov.in');
      setPassword('AdminPassword123!');
    } else if (role === 'Staff') {
      setEmail('EMP-TC-101');
      setPassword('StaffPassword123!');
    } else {
      setEmail('rahul.sharma@example.com');
      setPassword('Password123!');
    }
  };

  const handleSearchTrains = (e: React.FormEvent) => {
    e.preventDefault();
    // Redirect to passenger booking portal with search query if provided
    window.location.href = `/passenger/#journey-search`;
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (selectedRole === 'Admin') {
        const adminEmail = email.trim() || 'admin@railways.gov.in';
        const adminPass = password || 'AdminPassword123!';
        await login(adminEmail, adminPass);
        navigate(ADMIN_ROUTES.DASHBOARD);
      } else if (selectedRole === 'Staff') {
        // Validate staff credentials before navigating
        const staffId = email.trim() || 'EMP-TC-101';
        const staffPass = password || 'StaffPassword123!';
        await authService.staffLogin(staffId, staffPass);
        navigate('/staff');
      } else {
        // Passenger Portal — no server auth needed
        window.location.href = '/passenger/';
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  // Role accent colors - unified Indian Railway brand blue
  const roleColor = {
    Passenger: { border: '#2259c2', bg: '#eff4fc', text: '#1d4ed8' },
    Staff: { border: '#2259c2', bg: '#eff4fc', text: '#1d4ed8' },
    Admin: { border: '#2259c2', bg: '#eff4fc', text: '#1d4ed8' },
  }[selectedRole];

  return (
    <div
      className="min-h-screen flex flex-col bg-[#f4f7fb]"
      style={{ fontFamily: "'Inter', 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
    >

      {/* 1. TOP NAVIGATION BAR */}
      <nav className="bg-white px-6 sm:px-10 flex justify-between items-center border-b border-gray-200 relative z-20 h-[72px]">
        {/* Brand */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm" style={{ background: '#2259c2' }}>
            <Train className="w-5 h-5 text-white" />
          </div>
          <div className="leading-tight text-[#0f172a]">
            <div className="font-bold text-[13px] sm:text-sm leading-tight">Railway Reservation</div>
            <div className="font-bold text-[13px] sm:text-sm leading-tight" style={{ color: '#2259c2' }}>&amp; Management System</div>
          </div>
        </div>

        {/* Centre nav links */}
        <div className="hidden lg:flex gap-7 items-center text-[13px] font-medium" style={{ color: '#455c78' }}>
          <Link to="/" className="font-bold border-b-2 pb-0.5" style={{ color: '#2259c2', borderColor: '#2259c2' }}>Home</Link>
          <a href="/passenger/#journey-search" className="hover:text-[#2259c2] transition-colors">Book Tickets</a>
          <a href="/passenger/#train-tools" className="hover:text-[#2259c2] transition-colors">Train Info</a>
        </div>

        {/* Right CTA */}
        <div className="flex items-center gap-3">
          <a
            href="/passenger/"
            className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-[13px] font-semibold transition-all shadow-sm hover:opacity-95"
            style={{ background: '#2259c2' }}
          >
            <User size={15} /> Sign In
          </a>
        </div>
      </nav>

      {/* 2. HERO SECTION & NATURAL BACKGROUND */}
      <div
        className="flex-grow bg-cover bg-center relative flex items-center min-h-[calc(100vh-72px)]"
        style={{ backgroundImage: "url('/train-sunset.jpg')" }}
      >
        {/* Subtle, neutral cinematic gradient overlay (NO harsh bluish layer) */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(90deg, rgba(15,23,42,0.80) 0%, rgba(15,23,42,0.55) 45%, rgba(15,23,42,0.20) 100%)'
          }}
        />

        <div className="relative z-10 container mx-auto px-6 sm:px-8 grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-10 w-full py-12">
            
            {/* LEFT COLUMN: Text & Search Box */}
            <div className="flex flex-col justify-center text-white mt-4 lg:mt-0">
              <div
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[11px] font-bold uppercase tracking-widest w-fit mb-5 backdrop-blur-sm"
                style={{ background: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.25)', color: '#ffffff' }}
              >
                ✦ India's Official Railway Portal
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold mb-4 leading-[1.08] tracking-tight text-white drop-shadow-sm">
                Fast &amp; Easy<br />Train Bookings
              </h1>
              <p className="text-base sm:text-lg mb-8 max-w-lg text-slate-200">
                Search schedules, book seats, and manage your journey — all in one place.
              </p>

              {/* Clean Glassmorphic Search Container */}
              <div
                className="rounded-2xl p-5 sm:p-6 w-full shadow-2xl border backdrop-blur-md"
                style={{
                  background: 'rgba(15, 23, 42, 0.72)',
                  borderColor: 'rgba(255, 255, 255, 0.15)'
                }}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-white">Search Trains &amp; Availability</h3>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">Live</span>
                </div>
                <form onSubmit={handleSearchTrains} className="flex flex-col gap-3">
                  {/* Row 1: Stations */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 text-slate-400" size={16} />
                      <input
                        type="text"
                        placeholder="From Station (e.g. NDLS, CSMT)"
                        value={fromStation}
                        onChange={(e) => setFromStation(e.target.value)}
                        className="w-full pl-9 pr-3 h-10 rounded-lg bg-white text-slate-900 text-[13px] outline-none focus:ring-2 focus:ring-[#2259c2]"
                      />
                    </div>
                    <div className="relative">
                      <ArrowRightLeft className="absolute left-3 top-3 text-slate-400" size={16} />
                      <input
                        type="text"
                        placeholder="To Station (e.g. MMCT, HWH)"
                        value={toStation}
                        onChange={(e) => setToStation(e.target.value)}
                        className="w-full pl-9 pr-3 h-10 rounded-lg bg-white text-slate-900 text-[13px] outline-none focus:ring-2 focus:ring-[#2259c2]"
                      />
                    </div>
                  </div>

                  {/* Row 2: Date, Class, Button */}
                  <div className="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr_auto] gap-3">
                    <div className="relative">
                      <Calendar className="absolute left-3 top-3 text-slate-400" size={16} />
                      <input
                        type="date"
                        value={journeyDate}
                        onChange={(e) => setJourneyDate(e.target.value)}
                        className="w-full pl-9 pr-3 h-10 rounded-lg bg-white text-slate-800 text-[13px] outline-none focus:ring-2 focus:ring-[#2259c2]"
                      />
                    </div>
                    <div className="relative">
                      <Users className="absolute left-3 top-3 text-slate-400" size={16} />
                      <select
                        value={journeyClass}
                        onChange={(e) => setJourneyClass(e.target.value)}
                        className="w-full pl-9 pr-3 h-10 rounded-lg bg-white text-slate-800 text-[13px] outline-none focus:ring-2 focus:ring-[#2259c2] appearance-none"
                      >
                        <option value="">All Classes</option>
                        <option value="1A">AC First Class (1A)</option>
                        <option value="2A">AC 2 Tier (2A)</option>
                        <option value="3A">AC 3 Tier (3A)</option>
                        <option value="SL">Sleeper (SL)</option>
                        <option value="CC">Chair Car (CC)</option>
                      </select>
                    </div>
                    <button
                      type="submit"
                      className="h-10 text-white font-bold px-5 rounded-lg transition-all shadow-md flex items-center gap-2 text-[13px] whitespace-nowrap hover:opacity-95 cursor-pointer"
                      style={{ background: '#2259c2' }}
                    >
                      Search <ArrowRight size={14} />
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* RIGHT COLUMN: Multi-Role Login Card */}
            <div className="flex justify-center lg:justify-end items-center">
              <div className="bg-white p-6 sm:p-7 rounded-2xl shadow-[0_12px_40px_rgb(0,0,0,0.25)] w-full max-w-md text-gray-800 border border-gray-100">
                <div className="text-center mb-5">
                  <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight">
                    Sign In to RRMS
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">Select your portal role to continue</p>
                </div>

                {/* Role Selector - UNIFIED BLUE THEME FOR ALL ROLES */}
                <div className="grid grid-cols-3 gap-2.5 mb-5">
                  {(['Passenger', 'Staff', 'Admin'] as const).map((role) => {
                    const active = selectedRole === role;

                    return (
                      <button 
                        key={role}
                        type="button"
                        onClick={() => handleRoleSelect(role)} 
                        className="p-3 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer"
                        style={{
                          border: active ? '2px solid #2259c2' : '1px solid #e5e7eb',
                          background: active ? '#eff4fc' : '#ffffff',
                          color: active ? '#1d4ed8' : '#64748b'
                        }}
                      >
                        {role === 'Passenger' && (
                          <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect x="4" y="6" width="24" height="20" rx="3" fill={active ? '#2259c2' : 'white'} stroke="#2259c2" strokeWidth="2"/>
                            <path d="M9 13a4 4 0 118 0 4 4 0 01-8 0z" fill="white" stroke={active ? 'white' : '#2259c2'} strokeWidth="1.5"/>
                            <path d="M6 24v-2a4 4 0 014-4h6a4 4 0 014 4v2" stroke={active ? 'white' : '#2259c2'} strokeWidth="1.5" strokeLinecap="round"/>
                            <rect x="22" y="10" width="3" height="3" rx="0.5" fill={active ? 'white' : '#2259c2'}/>
                          </svg>
                        )}
                        {role === 'Staff' && (
                          <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect x="6" y="8" width="20" height="16" rx="2" fill={active ? '#2259c2' : 'white'} stroke="#2259c2" strokeWidth="2"/>
                            <circle cx="12" cy="16" r="3" fill="white" stroke={active ? 'white' : '#2259c2'} strokeWidth="1.5"/>
                            <path d="M18 14h4M18 18h4" stroke={active ? 'white' : '#2259c2'} strokeWidth="2" strokeLinecap="round"/>
                            <path d="M14 8V5c0-1.1.9-2 2-2h0c1.1 0 2 .9 2 2v3" stroke="#2259c2" strokeWidth="2" strokeLinecap="round"/>
                          </svg>
                        )}
                        {role === 'Admin' && (
                          <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M16 3L4 8v9c0 5.5 5 11 12 12 7-1 12-6.5 12-12V8l-12-5z" fill={active ? '#2259c2' : 'white'} stroke="#2259c2" strokeWidth="2" strokeLinejoin="round"/>
                            <circle cx="16" cy="15" r="4" fill="white" stroke={active ? '#2259c2' : '#2259c2'} strokeWidth="1.5"/>
                            <path d="M16 9v2M16 19v2M10 15h2M20 15h2M12 11l1.5 1.5M20 19l-1.5-1.5M20 11l-1.5 1.5M12 19l1.5-1.5" stroke={active ? 'white' : '#2259c2'} strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                        )}
                        <span className="text-[11px] font-bold mt-1.5 text-center leading-tight">
                          {role === 'Passenger' ? 'Passenger' : role === 'Staff' ? 'Staff / TC' : 'Admin'}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {error && (
                  <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Input Fields */}
                <form className="space-y-3.5" onSubmit={handleLoginSubmit}>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      {selectedRole === 'Admin' ? 'Official Admin Email' : selectedRole === 'Staff' ? 'Staff Employee ID / Email' : 'Passenger Email'}
                    </label>
                    <input 
                      type="text" 
                      placeholder={
                        selectedRole === 'Admin' 
                          ? 'admin@railways.gov.in' 
                          : selectedRole === 'Staff' 
                          ? 'EMP-TC-101' 
                          : 'rahul.sharma@example.com'
                      }
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-800 outline-none transition-colors"
                      onFocus={(e) => (e.currentTarget.style.borderColor = '#2259c2')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = '#d1d5db')}
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-xs font-semibold text-gray-700">Password</label>
                      <a href="#" className="text-xs hover:underline font-medium text-[#2259c2]">Forgot Password?</a>
                    </div>
                    <div className="relative">
                      <input 
                        type={showPassword ? 'text' : 'password'} 
                        placeholder="••••••••••••" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg pr-10 text-sm font-mono text-gray-800 outline-none transition-colors"
                        onFocus={(e) => (e.currentTarget.style.borderColor = '#2259c2')}
                        onBlur={(e) => (e.currentTarget.style.borderColor = '#d1d5db')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 cursor-pointer"
                      >
                        {showPassword ? <Eye size={16} /> : <EyeOff size={16} />}
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center text-xs">
                    <label className="flex items-center gap-2 cursor-pointer text-gray-600 select-none">
                      <input type="checkbox" defaultChecked={false} className="rounded border-gray-300 w-3.5 h-3.5 cursor-pointer" /> 
                      Remember Me
                    </label>
                    <span className="text-gray-400 text-[11px]">Demo: credentials prefilled</span>
                  </div>

                  <button 
                    type="submit"
                    disabled={loading}
                    className="w-full text-white font-bold py-3 rounded-lg transition-all shadow-md text-[13px] flex items-center justify-center gap-2 cursor-pointer hover:opacity-95"
                    style={{ background: '#2259c2' }}
                  >
                    {loading ? 'Entering Portal...' : `Enter ${selectedRole} Portal`}
                    {!loading && <ArrowRight size={15} />}
                  </button>
                </form>

              </div>
            </div>

        </div>
      </div>
    </div>
  );
}