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
        <div className="p-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-xl ${
                  isDestructive
                    ? 'bg-rose-100 text-rose-600'
                    : 'bg-orange-100 text-orange-600'
                }`}
              >
                <AlertTriangle className="w-4.5 h-4.5" style={{ width: '1.125rem', height: '1.125rem' }} />
              </div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">{title}</h3>
            </div>
            <button onClick={onCancel} className="btn-icon shrink-0 ml-2">
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="mt-3 text-body leading-relaxed pl-0">{message}</p>

          {requireReason && (
            <div className="mt-4">
              <label className="form-label">
                Reason (Required)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={reasonPlaceholder}
                rows={3}
                className="form-textarea"
              />
            </div>
          )}

          <div className="mt-5 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="btn-ghost"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isLoading || (requireReason && !reason.trim())}
              className={isDestructive ? 'btn-danger' : 'btn-secondary'}
            >
              {isLoading ? 'Processing...' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
