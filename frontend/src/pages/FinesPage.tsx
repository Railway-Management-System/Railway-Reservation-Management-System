import React, { useState } from 'react';
import { useStaff } from '../context/StaffContext';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';
import { FileText, Printer, DollarSign, AlertCircle } from 'lucide-react';

interface FinesPageProps {
  prefillName?: string;
  prefillIdRef?: string;
  prefillReason?: string;
}

export const FinesPage: React.FC<FinesPageProps> = ({
  prefillName = '',
  prefillIdRef = '',
  prefillReason = 'TICKETLESS_TRAVEL'
}) => {
  const { data, activeStaff, issueFine, setSelectedReceiptFine } = useStaff();

  const [passengerName, setPassengerName] = useState(prefillName);
  const [idProofReference, setIdProofReference] = useState(prefillIdRef);
  const [reason, setReason] = useState(prefillReason);
  const [amount, setAmount] = useState<number>(550);
  const [paymentStatus, setPaymentStatus] = useState<'PAID' | 'UNPAID'>('PAID');
  const [submitting, setSubmitting] = useState(false);

  const totalCollected = data.fines.reduce((acc, f) => acc + (f.paymentStatus === 'PAID' ? Number(f.amount) : 0), 0);
  const totalUnpaid = data.fines.reduce((acc, f) => acc + (f.paymentStatus === 'UNPAID' ? Number(f.amount) : 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passengerName.trim() || !idProofReference.trim() || submitting) return;

    setSubmitting(true);
    try {
      await issueFine({
        staffId: activeStaff.staffId,
        trainId: activeStaff.assignedTrainId || 101,
        passengerName: passengerName.trim(),
        idProofReference: idProofReference.trim(),
        reason,
        amount,
        paymentStatus
      });

      setPassengerName('');
      setIdProofReference('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Financial Metrics - Matching Admin StatCards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard
          title="Total Penalty Fines Collected"
          value={`₹${totalCollected.toFixed(2)}`}
          subtitle="Settled on-spot via Cash / UPI"
          icon={DollarSign}
          color="emerald"
        />

        <StatCard
          title="Unsettled / Pending Challans"
          value={`₹${totalUnpaid.toFixed(2)}`}
          subtitle="Issued for recovery at destination"
          icon={AlertCircle}
          color="rose"
        />
      </div>

      {/* Issue Fine Form */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
          <FileText className="w-5 h-5 text-orange-600" />
          <span>Issue On-Spot Penalty Challan</span>
        </h3>
        <p className="text-xs text-slate-500 mb-5">
          Enter passenger identification and violation details to generate an official digital penalty receipt.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Offending Passenger Name *</label>
              <input
                type="text"
                required
                value={passengerName}
                onChange={(e) => setPassengerName(e.target.value)}
                placeholder="Full passenger name"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 outline-none focus:border-orange-500 focus:bg-white transition-all"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">ID Proof / Phone Number *</label>
              <input
                type="text"
                required
                value={idProofReference}
                onChange={(e) => setIdProofReference(e.target.value)}
                placeholder="e.g. AADHAAR-1920 or Phone"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 outline-none focus:border-orange-500 focus:bg-white transition-all"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Violation Category *</label>
              <select
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setAmount(e.target.value === 'TICKETLESS_TRAVEL' ? 550 : 300);
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-orange-500 focus:bg-white cursor-pointer"
              >
                <option value="TICKETLESS_TRAVEL">Ticketless Travel (Section 138)</option>
                <option value="TRAVELLING_IN_HIGHER_CLASS_WITHOUT_UPGRADE">Travelling in Higher Class without Upgrade</option>
                <option value="UNBOOKED_EXCESS_LUGGAGE">Unbooked / Excess Luggage</option>
                <option value="SMOKING_NUISANCE">Smoking / Public Nuisance</option>
                <option value="IRREGULAR_TICKET">Irregular / Expired Ticket</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Penalty Amount (₹) *</label>
              <input
                type="number"
                required
                min={50}
                step={10}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 font-mono outline-none focus:border-orange-500 focus:bg-white transition-all"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Settlement Status *</label>
              <select
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value as 'PAID' | 'UNPAID')}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-orange-500 focus:bg-white cursor-pointer"
              >
                <option value="PAID">PAID (Cash / UPI collected)</option>
                <option value="UNPAID">UNPAID (Challan issued)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-2 transition-all"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{submitting ? 'Issuing Official Challan...' : 'Issue Official Challan'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Fine Log Table */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <h3 className="text-base font-bold text-slate-900 mb-4">Issued Penalty Records (Duty Log)</h3>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Receipt No.</th>
                <th className="py-3 px-4">Passenger</th>
                <th className="py-3 px-4">ID Reference</th>
                <th className="py-3 px-4">Offense</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Issued Timestamp</th>
                <th className="py-3 px-4 text-right">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.fines.map(f => (
                <tr key={f.fineId} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-orange-600">{f.receiptNumber}</td>
                  <td className="py-3 px-4 font-semibold text-slate-800">{f.passengerName}</td>
                  <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">{f.idProofReference}</td>
                  <td className="py-3 px-4 text-slate-700">{f.reason.replace(/_/g, ' ')}</td>
                  <td className="py-3 px-4 font-mono font-bold text-slate-900">₹{Number(f.amount).toFixed(2)}</td>
                  <td className="py-3 px-4">
                    <StatusBadge status={f.paymentStatus} size="sm" />
                  </td>
                  <td className="py-3 px-4 text-slate-500 text-[11px]">
                    {new Date(f.issuedAt).toLocaleDateString('en-GB')} {new Date(f.issuedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => setSelectedReceiptFine(f)}
                      className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold ml-auto flex items-center gap-1.5 transition-all"
                    >
                      <Printer className="w-3 h-3 text-slate-500" />
                      <span>Receipt</span>
                    </button>
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
