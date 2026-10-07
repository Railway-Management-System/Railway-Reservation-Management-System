import React from 'react';

interface StatusBadgeProps {
  status: string | null | undefined;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'sm' }) => {
  if (!status) return <span className="text-slate-400">—</span>;

  let colorClasses = 'bg-slate-100 text-slate-700 border-slate-200';

  const s = status.toUpperCase();

  if (['CONFIRMED', 'ACTIVE', 'ON_TIME', 'APPROVED', 'SUCCESS', 'PAID', 'RESOLVED', 'ON_DUTY'].includes(s)) {
    colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  } else if (['RAC', 'DELAYED', 'UNDER_REVIEW', 'PENDING', 'ATTENDING', 'IN_PROGRESS', 'MODERATE', 'MEDIUM', 'PAYMENT_PENDING'].includes(s)) {
    colorClasses = 'bg-amber-50 text-amber-700 border-amber-200';
  } else if (['WAITING_LIST', 'FILED', 'SUBMITTED', 'OFF_DUTY'].includes(s)) {
    colorClasses = 'bg-blue-50 text-blue-700 border-blue-200';
  } else if (['CANCELLED', 'SUSPENDED', 'FAILED', 'REJECTED', 'UNPAID', 'CRITICAL', 'HIGH', 'OVERCROWDED', 'NO_SHOW'].includes(s)) {
    colorClasses = 'bg-rose-50 text-rose-700 border-rose-200';
  }

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm font-medium';

  // Format label: replace underscores with spaces
  const label = status.replace(/_/g, ' ');

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${colorClasses} ${sizeClasses}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 opacity-70"></span>
      {label}
    </span>
  );
};
