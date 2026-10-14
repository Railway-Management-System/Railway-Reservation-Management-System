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
    orange: 'bg-orange-50 text-orange-600 border-orange-200/60',
    blue: 'bg-[#edf4ff] text-[#2452b8] border-blue-200/60',
    emerald: 'bg-[#eaf8f2] text-[#178365] border-emerald-200/60',
    amber: 'bg-[#fff5e6] text-[#bd7c17] border-amber-200/60',
    rose: 'bg-rose-50 text-rose-600 border-rose-200/60',
    purple: 'bg-purple-50 text-purple-600 border-purple-200/60',
  };

  return (
    <div className="bg-white rounded-2xl border border-[#e2e8f0] p-5 shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-all hover:shadow-[0_8px_20px_rgba(15,23,42,0.08)] hover:-translate-y-0.5 flex flex-col justify-between">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-meta font-bold uppercase tracking-wider block">{title}</span>
          <div className="mt-1.5 text-[1.375rem] font-extrabold tracking-tight text-[#172338] leading-none">{value}</div>
        </div>
        <div className={`p-2.5 rounded-xl border shrink-0 ${colorMap[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      {(subtitle || change) && (
        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
          {subtitle && <p className="text-meta line-clamp-1">{subtitle}</p>}
          {change && (
            <span
              className={`text-[11px] font-bold shrink-0 ml-auto ${
                isPositive ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {change}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
