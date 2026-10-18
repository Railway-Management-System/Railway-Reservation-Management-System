import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  subtitle?: string;
  change?: string;
  isPositive?: boolean;
  color?: 'orange' | 'blue' | 'emerald' | 'amber' | 'rose' | 'purple';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon: Icon,
  subtitle,
  change,
  isPositive,
  color = 'blue',
}) => {
  const colorMap = {
    orange: {
      bg: 'bg-orange-50',
      text: 'text-orange-600',
      border: 'border-orange-100',
      ring: 'ring-orange-100',
    },
    blue: {
      bg: 'bg-blue-50',
      text: 'text-blue-600',
      border: 'border-blue-100',
      ring: 'ring-blue-100',
    },
    emerald: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-600',
      border: 'border-emerald-100',
      ring: 'ring-emerald-100',
    },
    amber: {
      bg: 'bg-amber-50',
      text: 'text-amber-600',
      border: 'border-amber-100',
      ring: 'ring-amber-100',
    },
    rose: {
      bg: 'bg-rose-50',
      text: 'text-rose-600',
      border: 'border-rose-100',
      ring: 'ring-rose-100',
    },
    purple: {
      bg: 'bg-purple-50',
      text: 'text-purple-600',
      border: 'border-purple-100',
      ring: 'ring-purple-100',
    },
  };

  const c = colorMap[color];

  return (
    <div
      className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all"
      style={{ fontFamily: "'Inter', 'Plus Jakarta Sans', -apple-system, sans-serif" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{title}</span>
        <div className={`p-2.5 rounded-xl border ${c.bg} ${c.text} ${c.border}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="mt-4 flex items-baseline justify-between gap-2">
        <div className="text-2xl font-extrabold tracking-tight text-slate-900">{value}</div>
        {change && (
          <span
            className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
              isPositive
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-rose-50 text-rose-700 border border-rose-200'
            }`}
          >
            {change}
          </span>
        )}
      </div>
      {subtitle && <p className="mt-1.5 text-[11px] text-slate-400 font-medium">{subtitle}</p>}
    </div>
  );
};
