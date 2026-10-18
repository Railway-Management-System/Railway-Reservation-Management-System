import React from 'react';
import { AlertCircle } from 'lucide-react';

interface ContractGapBadgeProps {
  proposedEndpoint?: string;
  tooltip?: string;
}

export const ContractGapBadge: React.FC<ContractGapBadgeProps> = ({
  proposedEndpoint,
  tooltip,
}) => {
  return (
    <div
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-100 border border-amber-300 text-amber-900 text-xs font-medium shadow-sm"
      title={tooltip || (proposedEndpoint ? `Proposed API: ${proposedEndpoint}` : 'Endpoint pending in backend contract')}
    >
      <AlertCircle className="w-3.5 h-3.5 text-amber-700 flex-shrink-0" />
      <span>Mock data — endpoint pending</span>
      {proposedEndpoint && (
        <span className="font-mono text-[11px] bg-amber-200/70 px-1 py-0.5 rounded text-amber-950">
          {proposedEndpoint}
        </span>
      )}
    </div>
  );
};
