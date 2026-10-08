import React, { useState } from 'react';
import { Search, Loader2, Ticket, User, Calendar, MapPin, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { bookingService } from '../services/bookingService';
import { BookingDetail } from '../types/booking';
import { StatusBadge } from './StatusBadge';
import { formatCurrency, formatDate } from '../utils/format';

interface GlobalPnrSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalPnrSearchModal: React.FC<GlobalPnrSearchModalProps> = ({ isOpen, onClose }) => {
  const [pnrInput, setPnrInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BookingDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pnrInput.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await bookingService.getBookingByPnr(pnrInput.trim());
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'PNR not found or invalid.');
    } finally {
      setLoading(false);
    }
  };

  const handleNavigateToBookings = () => {
    onClose();
    navigate(`/admin/bookings?pnr=${pnrInput.trim()}`);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-start justify-center p-4 pt-20">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2 text-slate-800 font-semibold">
            <Ticket className="w-5 h-5 text-orange-600" />
            <span>Global PNR Quick Enquiry</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSearch} className="p-4 border-b border-slate-200 flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              autoFocus
              placeholder="Enter 10-digit PNR (e.g., 2849102841)..."
              value={pnrInput}
              onChange={(e) => setPnrInput(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono tracking-wider"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !pnrInput.trim()}
            className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Lookup
          </button>
        </form>

        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm">
              {error}
            </div>
          )}

          {result && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <span className="text-xs uppercase font-bold text-slate-400">PNR Number</span>
                  <div className="text-xl font-mono font-bold text-slate-900">{result.pnr}</div>
                </div>
                <StatusBadge status={result.bookingStatus} size="md" />
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div className="text-xs text-slate-500 flex items-center gap-1.5 mb-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    Journey Date
                  </div>
                  <div className="font-semibold text-slate-800">{formatDate(result.journeyDate)}</div>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div className="text-xs text-slate-500 flex items-center gap-1.5 mb-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    Train & Route
                  </div>
                  <div className="font-semibold text-slate-800 truncate">
                    {result.trainNumber} - {result.trainName}
                  </div>
                  <div className="text-xs text-slate-500">
                    {result.boardingStationCode} → {result.destinationStationCode}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Passengers ({result.passengers.length})
                </h4>
                <div className="space-y-2">
                  {result.passengers.map((p, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 bg-white text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-400" />
                        <span className="font-medium text-slate-800">{p.name}</span>
                        {p.coachNumber && p.seatNumber ? (
                          <span className="text-xs font-mono font-semibold bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                            Coach {p.coachNumber} / Seat {p.seatNumber} ({p.berthType})
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 italic">No seat allocated</span>
                        )}
                      </div>
                      <StatusBadge status={p.passengerStatus} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="text-sm">
                  <span className="text-slate-500">Total Fare: </span>
                  <span className="font-bold text-slate-900">{formatCurrency(result.totalFare)}</span>
                </div>
                <button
                  type="button"
                  onClick={handleNavigateToBookings}
                  className="text-xs font-semibold text-orange-600 hover:text-orange-700 hover:underline"
                >
                  Manage in Reservations →
                </button>
              </div>
            </div>
          )}

          {!result && !error && !loading && (
            <div className="text-center py-8 text-slate-400 text-sm">
              Type any booking PNR to query passenger status, coach allocation, and payment history.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
