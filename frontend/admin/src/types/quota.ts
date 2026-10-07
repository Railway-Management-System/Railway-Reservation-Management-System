import { Quota } from '../constants/enums';

export interface QuotaRule {
  quotaRuleId: number;
  quota: Quota;
  allocatedPercentage: number;
  description: string;
}
