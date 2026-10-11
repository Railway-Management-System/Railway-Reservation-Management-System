import React from 'react';
import { useStaff } from '../context/StaffContext';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts } = useStaff();

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2.5 pointer-events-none">
      {toasts.map(toast => {
        let borderClass = 'border-l-4 border-l-cyan-500';
        let Icon = Info;
        let iconColor = 'text-cyan-400';

        if (toast.type === 'success') {
          borderClass = 'border-l-4 border-l-emerald-500';
          Icon = CheckCircle2;
          iconColor = 'text-emerald-400';
        } else if (toast.type === 'error') {
          borderClass = 'border-l-4 border-l-rose-500';
          Icon = AlertCircle;
          iconColor = 'text-rose-400';
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto bg-slate-900/95 border border-slate-800 ${borderClass} text-slate-100 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 min-w-[280px] max-w-md animate-in slide-in-from-bottom-5 duration-200 backdrop-blur-md`}
          >
            <Icon className={`w-4 h-4 flex-shrink-0 ${iconColor}`} />
            <div className="text-xs font-medium leading-relaxed">{toast.msg}</div>
          </div>
        );
      })}
    </div>
  );
};
