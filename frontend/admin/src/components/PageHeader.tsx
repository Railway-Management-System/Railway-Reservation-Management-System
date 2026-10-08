import React from 'react';
import { ContractGapBadge } from './ContractGapBadge';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  contractGapProposedEndpoint?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  actions,
  contractGapProposedEndpoint,
}) => {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200">
      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          {contractGapProposedEndpoint && (
            <ContractGapBadge proposedEndpoint={contractGapProposedEndpoint} />
          )}
        </div>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
};
