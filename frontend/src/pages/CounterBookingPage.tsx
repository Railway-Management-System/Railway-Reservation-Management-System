import React, { useState } from 'react';
import { useStaff } from '../context/StaffContext';
import { Ticket, User, CreditCard, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export const CounterBookingPage: React.FC = () => {
  const { createCounterBooking, activeStaff } = useStaff();

  const [trainId, setTrainId] = useState<number>(101);
  const [scheduleId, setScheduleId] = useState<number>(1001);
  const [sourceStationId, setSourceStationId] = useState<number>(7); // Mumbai
  const [destStationId, setDestStationId] = useState<number>(1);   // New Delhi
  const [journeyDate, setJourneyDate] = useState<string>('2026-10-28');
  const [classType, setClassType] = useState<string>('3A');
  const [quota, setQuota] = useState<string>('GENERAL');

  // Passenger details
  const [name, setName] = useState<string>('');
  const [age, setAge] = useState<number>(30);
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | 'OTHER'>('MALE');
  const [idType, setIdType] = useState<string>('AADHAAR');
  const [idNumber, setIdNumber] = useState<string>('');
  const [berthPreference, setBerthPreference] = useState<string>('LOWER');

  const [loading, setLoading] = useState<boolean>(false);
  const [bookingResult, setBookingResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !idNumber.trim()) {
      setError('Please provide passenger name and official ID number');
      return;
    }

    setLoading(true);
    setError(null);
    setBookingResult(null);

    const payload = {
      trainId,
      journeyDate,
      boardingStationId: sourceStationId,
      destinationStationId: destStationId,
      classType,
      quota,
      isWalkin: true,
      registeredUserId: null,
      passengers: [
        {
          name: name.trim(),
          age: Number(age),
          gender,
          berthPreference,
          idProofType: idType,
          idProofReference: idNumber.trim()
        }
      ],
      payment: {
        method: 'CASH'
      }
    };

    try {
      const res = await createCounterBooking(payload);
      setBookingResult(res);
      // Reset passenger fields
      setName('');
      setIdNumber('');
    } catch (err: any) {
      setError(err.message || 'Counter booking failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-[#2259c2] text-white flex items-center justify-center shadow-xs">
            <Ticket className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Station Walk-In Counter Booking Terminal</h3>
            <p className="text-xs text-slate-500">
              Immediate reservation issue for walk-in passengers with cash settlement (Official Staff Terminal).
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {bookingResult && (
          <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs space-y-2 animate-in fade-in">
            <div className="flex items-center gap-2 font-bold text-sm text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Counter Ticket Issued Successfully!</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-xs">
              <div>PNR: <strong className="text-emerald-950 font-bold">{bookingResult.pnr || bookingResult.booking?.pnr || 'GENERATED'}</strong></div>
              <div>Status: <strong>{bookingResult.bookingStatus || bookingResult.booking?.status || 'CONFIRMED'}</strong></div>
              <div>Fare: <strong>₹{bookingResult.totalFare || bookingResult.booking?.totalFare || 1450}</strong></div>
              <div>Payment: <strong>CASH (Confirmed)</strong></div>
            </div>
          </div>
        )}

        <form onSubmit={handleBooking} className="space-y-5 mt-5">
          {/* Journey Parameters */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wide">1. Journey & Train Details</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">Train Run / Number</label>
                <select
                  value={trainId}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    setTrainId(id);
                    setScheduleId(id === 101 ? 1001 : 1002);
                  }}
                  className="w-full bg-white border border-slate-200 focus:border-[#2259c2] rounded-lg px-3 py-2 text-xs text-slate-800 outline-none"
                >
                  <option value={101}>12951 - Mumbai Tejas Rajdhani</option>
                  <option value={102}>12952 - New Delhi Mumbai Tejas</option>
                  <option value={105}>22436 - Vande Bharat Express</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">Journey Date</label>
                <input
                  type="date"
                  value={journeyDate}
                  onChange={(e) => setJourneyDate(e.target.value)}
                  className="w-full bg-white border border-slate-200 focus:border-[#2259c2] rounded-lg px-3 py-2 text-xs text-slate-800 outline-none font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">Class & Quota</label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={classType}
                    onChange={(e) => setClassType(e.target.value)}
                    className="w-full bg-white border border-slate-200 focus:border-[#2259c2] rounded-lg px-2 py-2 text-xs text-slate-800 outline-none"
                  >
                    <option value="1A">1A</option>
                    <option value="2A">2A</option>
                    <option value="3A">3A</option>
                    <option value="SL">SL</option>
                  </select>
                  <select
                    value={quota}
                    onChange={(e) => setQuota(e.target.value)}
                    className="w-full bg-white border border-slate-200 focus:border-[#2259c2] rounded-lg px-2 py-2 text-xs text-slate-800 outline-none"
                  >
                    <option value="GENERAL">GENERAL</option>
                    <option value="TATKAL">TATKAL</option>
                    <option value="LADIES">LADIES</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Passenger Information */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wide">2. Passenger Identification (Photo ID Required)</div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-2">
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">Passenger Full Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="As per Government ID"
                  className="w-full bg-white border border-slate-200 focus:border-[#2259c2] rounded-lg px-3 py-2 text-xs text-slate-800 outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">Age & Gender</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min={5}
                    max={120}
                    value={age}
                    onChange={(e) => setAge(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 focus:border-[#2259c2] rounded-lg px-2 py-2 text-xs text-slate-800 outline-none font-mono"
                  />
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as any)}
                    className="w-full bg-white border border-slate-200 focus:border-[#2259c2] rounded-lg px-2 py-2 text-xs text-slate-800 outline-none"
                  >
                    <option value="MALE">M</option>
                    <option value="FEMALE">F</option>
                    <option value="OTHER">O</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">Berth Preference</label>
                <select
                  value={berthPreference}
                  onChange={(e) => setBerthPreference(e.target.value)}
                  className="w-full bg-white border border-slate-200 focus:border-[#2259c2] rounded-lg px-3 py-2 text-xs text-slate-800 outline-none"
                >
                  <option value="LOWER">LOWER</option>
                  <option value="MIDDLE">MIDDLE</option>
                  <option value="UPPER">UPPER</option>
                  <option value="SIDE_LOWER">SIDE LOWER</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">Photo ID Document *</label>
                <select
                  value={idType}
                  onChange={(e) => setIdType(e.target.value)}
                  className="w-full bg-white border border-slate-200 focus:border-[#2259c2] rounded-lg px-3 py-2 text-xs text-slate-800 outline-none"
                >
                  <option value="AADHAAR">Aadhaar Card</option>
                  <option value="PAN">PAN Card</option>
                  <option value="VOTER_ID">Voter ID</option>
                  <option value="PASSPORT">Passport</option>
                </select>
              </div>

              <div className="sm:col-span-3">
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">ID Number / Reference *</label>
                <input
                  type="text"
                  required
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  placeholder="e.g. 1234-5678-9012"
                  className="w-full bg-white border border-slate-200 focus:border-[#2259c2] rounded-lg px-3 py-2 text-xs text-slate-800 outline-none font-mono"
                />
              </div>
            </div>
          </div>

          {/* Payment & Confirmation */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-blue-50/60 border border-blue-200 rounded-xl">
            <div className="flex items-center gap-3">
              <CreditCard className="w-5 h-5 text-[#2259c2]" />
              <div>
                <div className="text-xs font-bold text-slate-900">Cash Payment at Counter</div>
                <div className="text-[11px] text-slate-500">Collected in full by Officer {activeStaff.name} before PNR generation.</div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-[#2259c2] hover:bg-[#1748a5] disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing Counter Booking...</span>
                </>
              ) : (
                <>
                  <Ticket className="w-4 h-4" />
                  <span>Collect Cash & Issue Ticket</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
