import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  requireReason?: boolean;
  reasonPlaceholder?: string;
  onConfirm: (reason?: string) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = true,
  requireReason = false,
  reasonPlaceholder = 'Enter reason...',
  onConfirm,
  onCancel,
  isLoading = false,
}) => {
  const [reason, setReason] = useState('');

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (requireReason && !reason.trim()) return;
    onConfirm(reason.trim() || undefined);
    setReason('');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-xl ${
                  isDestructive
                    ? 'bg-rose-100 text-rose-600'
                    : 'bg-orange-100 text-orange-600'
                }`}
              >
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">{title}</h3>
            </div>
            <button
              onClick={onCancel}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="mt-3 text-sm text-slate-600 leading-relaxed">{message}</p>

          {requireReason && (
            <div className="mt-4">
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                Reason (Required)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={reasonPlaceholder}
                rows={3}
                className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          )}

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isLoading || (requireReason && !reason.trim())}
              className={`px-4 py-2 text-sm font-semibold rounded-lg text-white shadow-sm transition-colors flex items-center gap-2 ${
                isDestructive
                  ? 'bg-rose-600 hover:bg-rose-700 focus:ring-2 focus:ring-rose-500'
                  : 'bg-orange-600 hover:bg-orange-700 focus:ring-2 focus:ring-orange-500'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isLoading ? 'Processing...' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
