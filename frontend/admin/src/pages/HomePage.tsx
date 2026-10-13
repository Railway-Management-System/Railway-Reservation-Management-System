import { useState } from 'react';
import { 
  HelpCircle, MapPin, ArrowRightLeft, 
  Calendar, Users, User, EyeOff, ChevronDown
} from 'lucide-react';

export default function HomePage() {
  const [selectedRole, setSelectedRole] = useState('Passenger');

  return (
    <div className="min-h-screen flex flex-col font-sans bg-gray-50">
      
      {/* 1. TOP NAVIGATION BAR */}
      <nav className="bg-white px-8 py-4 flex justify-between items-center shadow-sm relative z-20">
        <div className="flex items-center gap-3">
          
          {/* Custom RRMS Logo (Tracks & Orange Gear) */}
         {/* Custom RRMS Logo */}
<img src="/train-icon.svg" alt="RRMS Logo" className="w-12 h-auto" />

          <div className="leading-tight text-[#0f172a]">
            <h1 className="font-bold text-lg">Railway Reservation &</h1>
            <h1 className="font-bold text-lg">Management System</h1>
          </div>
        </div>
        
        <div className="hidden md:flex gap-8 text-gray-700 font-medium">
          <a href="#" className="text-blue-600 border-b-2 border-blue-600 pb-1">Home</a>
          <a href="#" className="hover:text-blue-600">Schedules</a>
          <a href="#" className="hover:text-blue-600">PNR Status</a>
        </div>

        <div className="flex items-center gap-6">
          <a href="#" className="flex items-center gap-2 text-gray-600 hover:text-black">
            <HelpCircle size={18} /> Help
          </a>
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-md font-medium flex items-center gap-2 transition-colors">
            <User size={18} /> Sign In <ChevronDown size={16} />
          </button>
        </div>
      </nav>

      {/* 2. HERO SECTION & BACKGROUND */}
      <div 
        className="flex-grow bg-cover bg-center relative flex items-center"
        style={{ backgroundImage: "url('/train-sunset.jpg')" }} 
      >
        <div className="absolute inset-0 bg-black bg-opacity-40"></div>

        <div className="relative z-10 container mx-auto px-8 grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-12 w-full py-12">
            
            {/* LEFT COLUMN: Text & Search Box */}
            <div className="flex flex-col justify-center text-white mt-10 lg:mt-0">
              <h1 className="text-6xl font-bold mb-4 leading-tight tracking-tight">Fast & Easy<br/>Train Bookings</h1>
              <p className="text-xl mb-10 text-gray-200">Your Journey, Planned in Minutes</p>

              <div className="bg-[#0f172a] p-6 rounded-2xl w-full shadow-2xl border border-gray-700">
                {/* Fixed Typography Weight: Extra Bold */}
                <h3 className="text-xl font-extrabold mb-4 text-white">Search Trains</h3>
                
                <div className="flex flex-col gap-4">
                  {/* Row 1: Stations */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3.5 text-gray-400" size={20} />
                      <input type="text" placeholder="From Station" className="w-full pl-10 h-12 rounded-lg bg-white text-black outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="relative">
                      <ArrowRightLeft className="absolute left-3 top-3.5 text-gray-400" size={20} />
                      <input type="text" placeholder="To Station" className="w-full pl-10 h-12 rounded-lg bg-white text-black outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                  
                  {/* Row 2: Date, Class, Button (Fixed Grid Proportions) */}
                  <div className="grid grid-cols-[1.5fr_1fr_auto] gap-4">
                    <div className="relative">
                      <Calendar className="absolute left-3 top-3.5 text-gray-400" size={20} />
                      {/* Fixed Date Placeholder Trick */}
                      <input 
                        type="text" 
                        placeholder="Date of Journey" 
                        onFocus={(e) => e.target.type = 'date'}
                        onBlur={(e) => { if (!e.target.value) e.target.type = 'text' }}
                        className="w-full pl-10 h-12 rounded-lg bg-white text-gray-600 outline-none focus:ring-2 focus:ring-blue-500" 
                      />
                    </div>
                    <div className="relative">
                      <Users className="absolute left-3 top-3.5 text-gray-400" size={20} />
                      <select className="w-full pl-10 h-12 rounded-lg bg-white text-black outline-none focus:ring-2 focus:ring-blue-500 appearance-none">
                        <option>Class</option>
                        <option>All Classes</option>
                        <option>Sleeper</option>
                      </select>
                    </div>
                    <button className="h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 rounded-lg transition-colors shadow-md flex items-center justify-center">
                      Search Trains
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Multi-Role Login Card */}
            <div className="flex justify-center lg:justify-end items-center">
              <div className="bg-white p-8 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] w-full max-w-md text-gray-800">
                <h2 className="text-2xl font-extrabold mb-6 text-center text-gray-900 tracking-tight">Sign In to Your Account.</h2>

                {/* Custom SVG Role Icons */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                  
                  {/* Admin Button */}
                  <button onClick={() => setSelectedRole('Admin')} className={`p-4 rounded-xl flex flex-col items-center justify-center transition-all ${selectedRole === 'Admin' ? 'border-2 border-orange-500 bg-orange-50 text-orange-700' : 'border border-gray-200 hover:border-gray-300'}`}>
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M16 3L4 8v9c0 5.5 5 11 12 12 7-1 12-6.5 12-12V8l-12-5z" fill={selectedRole === 'Admin' ? '#F97316' : 'white'} stroke="#F97316" strokeWidth="2" strokeLinejoin="round"/>
                      <circle cx="16" cy="15" r="4" fill="white" stroke={selectedRole === 'Admin' ? '#F97316' : '#F97316'} strokeWidth="1.5"/>
                      <path d="M16 9v2M16 19v2M10 15h2M20 15h2M12 11l1.5 1.5M20 19l-1.5-1.5M20 11l-1.5 1.5M12 19l1.5-1.5" stroke={selectedRole === 'Admin' ? 'white' : '#F97316'} strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    <span className="text-xs font-bold mt-2">Admin</span>
                  </button>

                  {/* Staff Button */}
                  <button onClick={() => setSelectedRole('Staff')} className={`p-4 rounded-xl flex flex-col items-center justify-center transition-all ${selectedRole === 'Staff' ? 'border-2 border-orange-500 bg-orange-50 text-orange-700' : 'border border-gray-200 hover:border-gray-300'}`}>
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="6" y="8" width="20" height="16" rx="2" fill={selectedRole === 'Staff' ? '#F97316' : 'white'} stroke="#F97316" strokeWidth="2"/>
                      <circle cx="12" cy="16" r="3" fill="white" stroke={selectedRole === 'Staff' ? 'white' : '#F97316'} strokeWidth="1.5"/>
                      <path d="M18 14h4M18 18h4" stroke={selectedRole === 'Staff' ? 'white' : '#F97316'} strokeWidth="2" strokeLinecap="round"/>
                      <path d="M14 8V5c0-1.1.9-2 2-2h0c1.1 0 2 .9 2 2v3" stroke="#F97316" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    <span className="text-xs font-bold mt-2">Staff / TC</span>
                  </button>

                  {/* Passenger Button */}
                  <button onClick={() => setSelectedRole('Passenger')} className={`p-4 rounded-xl flex flex-col items-center justify-center transition-all ${selectedRole === 'Passenger' ? 'border-2 border-blue-600 bg-blue-50 text-blue-800' : 'border border-gray-200 hover:border-gray-300'}`}>
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="4" y="6" width="24" height="20" rx="3" fill={selectedRole === 'Passenger' ? '#2563EB' : 'white'} stroke="#2563EB" strokeWidth="2"/>
                      <path d="M9 13a4 4 0 118 0 4 4 0 01-8 0z" fill="white" stroke={selectedRole === 'Passenger' ? 'white' : '#2563EB'} strokeWidth="1.5"/>
                      <path d="M6 24v-2a4 4 0 014-4h6a4 4 0 014 4v2" stroke={selectedRole === 'Passenger' ? 'white' : '#2563EB'} strokeWidth="1.5" strokeLinecap="round"/>
                      <rect x="22" y="10" width="3" height="3" rx="0.5" fill={selectedRole === 'Passenger' ? 'white' : '#2563EB'}/>
                    </svg>
                    <span className="text-xs font-bold mt-2 text-center">Passenger<br/>/ User</span>
                  </button>

                </div>

                {/* Input Fields */}
                <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
                  <input 
                    type="text" 
                    placeholder="Username / Email ID" 
                    className="w-full p-3.5 border border-gray-300 rounded-lg focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                  <div className="relative">
                    <input 
                      type="password" 
                      placeholder="Password" 
                      className="w-full p-3.5 border border-gray-300 rounded-lg focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 pr-10"
                    />
                    <EyeOff className="absolute right-4 top-4 text-gray-400 cursor-pointer hover:text-gray-600" size={20} />
                  </div>
                  
                  <div className="flex justify-between items-center text-sm">
                    <label className="flex items-center gap-2 cursor-pointer text-gray-600">
                      {/* Fixed Checkbox: Unchecked by default */}
                      <input type="checkbox" defaultChecked={false} className="rounded border-gray-300 w-4 h-4 cursor-pointer" /> Remember Me
                    </label>
                    <a href="#" className="text-blue-600 hover:underline font-medium">Forgot Password?</a>
                  </div>

                  <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-lg mt-2 transition-colors shadow-lg">
                    Login to Dashboard
                  </button>
                </form>

                <div className="text-center mt-6 text-sm text-gray-600">
                  New user? <a href="#" className="text-blue-600 hover:underline font-bold">Register</a> (Passenger Only)
                </div>
              </div>
            </div>

        </div>
      </div>
    </div>
  );
}