import React, { useState, useEffect } from 'react';
import { useStaff } from '../context/StaffContext';
import { StatusBadge } from '../components/StatusBadge';
import { Search, CheckCircle, AlertTriangle, XCircle, FileWarning, Loader2 } from 'lucide-react';
import { staffApiService, PnrBookingDetails } from '../services/staffApiService';

interface ScannerPageProps {
  initialPnr?: string;
  onIssueFinePrefill?: (name: string, idRef: string, reason: string) => void;
}

export const ScannerPage: React.FC<ScannerPageProps> = ({ initialPnr = '', onIssueFinePrefill }) => {
  const { data, markPassengerBoarding, verifyPassenger, boardPassengerApi, noShowPassengerApi } = useStaff();
  const [pnrInput, setPnrInput] = useState<string>(initialPnr);
  const [notes, setNotes] = useState<string>('');
  const [searching, setSearching] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [liveBooking, setLiveBooking] = useState<PnrBookingDetails | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    if (initialPnr) setPnrInput(initialPnr);
  }, [initialPnr]);

  // Live PNR fetch when 10 digits entered
  useEffect(() => {
    const trimmed = pnrInput.trim();
    if (trimmed.length === 10) {
      setSearching(true);
      setSearchError(null);
      staffApiService.getBookingByPnr(trimmed)
        .then(res => {
          if (res && res.pnr) {
            setLiveBooking(res);
          } else {
            setLiveBooking(null);
          }
        })
        .catch(err => {
          setLiveBooking(null);
          setSearchError(err.message || 'PNR not found in live system');
        })
        .finally(() => {
          setSearching(false);
        });
    } else {
      setLiveBooking(null);
      setSearchError(null);
    }
  }, [pnrInput]);

  const localPassenger = data.manifest.find(m => m.pnr === pnrInput.trim() || (pnrInput.trim().length >= 4 && m.pnr.includes(pnrInput.trim())));

  // Unified passenger view: live booking's first passenger if found, or local manifest passenger
  const passenger = liveBooking ? {
    manifestId: localPassenger ? localPassenger.manifestId : 9999,
    name: liveBooking.passengers?.[0]?.name || 'Passenger',
    pnr: liveBooking.pnr,
    age: liveBooking.passengers?.[0]?.age || 30,
    gender: liveBooking.passengers?.[0]?.gender || 'MALE',
    quota: liveBooking.quota,
    coachNumber: liveBooking.passengers?.[0]?.coachNumber || null,
    seatNumber: liveBooking.passengers?.[0]?.seatNumber || null,
    berthType: liveBooking.passengers?.[0]?.berthType || null,
    classType: liveBooking.classType || '3A',
    bookingStatus: (liveBooking.passengers?.[0]?.status as any) || liveBooking.bookingStatus,
    boardingStatus: localPassenger ? localPassenger.boardingStatus : 'NOT_VERIFIED',
    verificationStatus: localPassenger ? localPassenger.verificationStatus : 'UNCHECKED',
    verificationNotes: localPassenger ? localPassenger.verificationNotes : '',
    idProofType: 'GOVT_ID',
    idProofReference: `PNR-${liveBooking.pnr}`,
    boardingStationId: 1,
    destinationStationId: 2,
    passengerNo: liveBooking.passengers?.[0]?.passengerNo || 1
  } : localPassenger ? {
    ...localPassenger,
    passengerNo: localPassenger.passengerId || 1
  } : null;

  const handleDecision = async (verifyStatus: 'VALID' | 'INVALID' | 'MISMATCH', boardStatus: 'BOARDED' | 'NO_SHOW' | 'NOT_VERIFIED') => {
    if (!passenger || actionLoading) return;
    setActionLoading(true);

    try {
      if (localPassenger) {
        await markPassengerBoarding(localPassenger.manifestId, boardStatus, verifyStatus, notes);
      } else {
        // Direct server API calls for live PNR
        await verifyPassenger(passenger.pnr, passenger.passengerNo, verifyStatus, notes);
        if (boardStatus === 'BOARDED') {
          await boardPassengerApi(passenger.pnr, passenger.passengerNo);
        } else if (boardStatus === 'NO_SHOW') {
          await noShowPassengerApi(passenger.pnr, passenger.passengerNo);
        }
      }
    } finally {
      setActionLoading(false);
    }
  };

  const samplePnrs = ['2849102841', '5183920194', '4920194820', '7729103841'];

  return (
    <div className="space-y-6">
      {/* Scanner Hero - Matching Admin Style */}
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center flex flex-col items-center justify-center shadow-xs">
        <div className="w-14 h-14 rounded-full bg-orange-50 text-orange-600 border border-orange-200 flex items-center justify-center mb-3 text-2xl shadow-sm">
          <Search className="w-7 h-7" />
        </div>
        <h3 className="text-xl font-bold text-slate-900">Digital Ticket & PNR Inspection Terminal</h3>
        <p className="text-xs text-slate-500 max-w-lg mt-1 mb-5">
          Scan or input the 10-digit Passenger Name Record (PNR) to inspect authorized identity proof and authenticate travel boarding.
        </p>

        <div className="w-full max-w-md">
          <input
            type="text"
            value={pnrInput}
            onChange={(e) => setPnrInput(e.target.value)}
            placeholder="ENTER 10-DIGIT PNR..."
            className="w-full bg-slate-50 border border-slate-300 focus:border-orange-500 focus:bg-white rounded-xl px-4 py-3 text-center font-mono text-base font-bold tracking-widest text-slate-900 outline-none shadow-xs transition-all"
          />
        </div>

        <div className="flex items-center gap-2 mt-4 flex-wrap justify-center">
          <span className="text-[11px] text-slate-400 font-medium">Quick Test PNRs:</span>
          {samplePnrs.map(p => (
            <button
              key={p}
              onClick={() => {
                setPnrInput(p);
                const found = data.manifest.find(m => m.pnr === p);
                if (found) setNotes(found.verificationNotes || '');
              }}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-mono font-medium transition-all"
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Lookup Card */}
      {pnrInput.trim().length >= 4 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs animate-in fade-in duration-200">
          {!passenger ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">⚠️</div>
              <h4 className="text-base font-bold text-rose-600">PNR {pnrInput} Not Found Onboard</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                No active reservation located for this train trip. If passenger is travelling without valid booking, issue an on-spot ticketless penalty.
              </p>
              {onIssueFinePrefill && (
                <button
                  onClick={() => onIssueFinePrefill('', pnrInput, 'TICKETLESS_TRAVEL')}
                  className="mt-4 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold shadow-xs"
                >
                  Issue Ticketless Travel Fine
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-bold text-slate-900">{passenger.name}</h3>
                    {passenger.coachNumber && passenger.seatNumber ? (
                      <span className="font-mono text-sm font-bold bg-orange-50 border border-orange-200 text-orange-700 px-2.5 py-0.5 rounded-lg">
                        {passenger.coachNumber}-{passenger.seatNumber}
                      </span>
                    ) : (
                      <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg">Berth Pending</span>
                    )}
                    <StatusBadge status={passenger.bookingStatus} size="sm" />
                  </div>
                  <div className="text-xs text-slate-500 mt-1 font-mono">
                    PNR: <strong className="text-slate-800">{passenger.pnr}</strong> • {passenger.age}y / {passenger.gender} • Quota: <strong className="text-slate-800">{passenger.quota}</strong>
                  </div>
                </div>

                <div className="sm:text-right">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase">Boarding Status</div>
                  <div className="mt-1">
                    <StatusBadge status={passenger.boardingStatus} size="md" />
                  </div>
                </div>
              </div>

              {/* Passenger Attributes Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase">Travel Sector & Class</div>
                  <div className="text-sm font-bold text-slate-900 mt-1">
                    {data.stations.find(s => s.stationId === passenger.boardingStationId)?.stationName || 'Mumbai Central'} ➔ {data.stations.find(s => s.stationId === passenger.destinationStationId)?.stationName || 'New Delhi'}
                  </div>
                  <div className="text-xs text-orange-600 font-medium mt-1">Class: {passenger.classType} • Berth: {passenger.berthType || 'None'}</div>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase">Official ID Document</div>
                  <div className="text-sm font-bold text-blue-700 mt-1">{passenger.idProofType}</div>
                  <div className="text-xs font-mono text-slate-700 font-medium mt-1">{passenger.idProofReference}</div>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase">Verification Stamp</div>
                  <div className="mt-1">
                    <StatusBadge status={passenger.verificationStatus} size="sm" />
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 truncate">{passenger.verificationNotes || 'No inspector remarks recorded'}</div>
                </div>
              </div>

              {/* Inspector Decision Panel */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                <label className="text-xs font-semibold text-slate-700 block mb-2">Inspector Verification Remarks & Findings:</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Original Aadhaar physical card inspected, details match exactly..."
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 outline-none focus:border-orange-500 mb-4 shadow-2xs"
                />

                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    disabled={actionLoading}
                    onClick={() => handleDecision('VALID', 'BOARDED')}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition-all"
                  >
                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    <span>Accept & Mark ID VALID</span>
                  </button>

                  <button
                    disabled={actionLoading}
                    onClick={() => handleDecision('INVALID', 'NO_SHOW')}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition-all"
                  >
                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                    <span>Reject & Mark INVALID (No-Show)</span>
                  </button>

                  <button
                    disabled={actionLoading}
                    onClick={() => handleDecision('MISMATCH', 'NOT_VERIFIED')}
                    className="px-4 py-2 bg-amber-50 hover:bg-amber-100 disabled:opacity-50 text-amber-700 border border-amber-200 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    <span>ID MISMATCH (Request Proof)</span>
                  </button>

                  {onIssueFinePrefill && (
                    <button
                      onClick={() => onIssueFinePrefill(passenger.name, passenger.idProofReference, 'TRAVELLING_IN_HIGHER_CLASS_WITHOUT_UPGRADE')}
                      className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all"
                    >
                      <FileWarning className="w-4 h-4" />
                      <span>Issue Penalty Challan</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
