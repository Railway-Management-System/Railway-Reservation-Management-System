import { isServiceMock } from '../config/api.config';
import { httpRequest } from './http.client';
import { simulateLatency } from './mock.client';

export interface SystemSetting {
  settingKey: string;
  settingValue: string;
  description?: string;
  updatedAt?: string;
}

const MOCK_SETTINGS: SystemSetting[] = [
  { settingKey: 'BOOKING_WINDOW_DAYS', settingValue: '120', description: 'Advance reservation window in calendar days' },
  { settingKey: 'CHART_HOURS_BEFORE_ORIGIN_DEPARTURE', settingValue: '4', description: 'Cut-off for chart preparation prior to train departure' },
  { settingKey: 'CLERKAGE_PER_PASSENGER', settingValue: '60', description: 'Flat administrative deduction per passenger on ticket cancellation' },
  { settingKey: 'CONCESSION_SENIOR_ENABLED', settingValue: 'true', description: 'Toggle for senior citizen concession booking' },
  { settingKey: 'DYNAMIC_FARE_ENABLED', settingValue: 'false', description: 'Dynamic flexi-fare surge algorithm' },
  { settingKey: 'GST_RATE_AC', settingValue: '5', description: 'Applicable GST rate on AC class fares' },
  { settingKey: 'HOLD_MINUTES', settingValue: '10', description: 'Temporary lock duration during seat reservation hold' },
  { settingKey: 'INSURANCE_PREMIUM_PER_PASSENGER', settingValue: '0.45', description: 'Optional transit insurance premium per passenger' },
  { settingKey: 'MAX_PASSENGERS_PER_PNR', settingValue: '6', description: 'Maximum passengers permitted in single regular booking' },
  { settingKey: 'MAX_PASSENGERS_PER_PNR_TATKAL', settingValue: '4', description: 'Maximum passengers permitted under Tatkal quota' },
  { settingKey: 'MAX_TICKETS_PER_MONTH', settingValue: '12', description: 'Standard monthly ticket quota per user' },
  { settingKey: 'MAX_TICKETS_PER_MONTH_AADHAAR_VERIFIED', settingValue: '24', description: 'Enhanced monthly ticket quota for Aadhaar verified users' },
  { settingKey: 'MIN_CHARGEABLE_DISTANCE_KM', settingValue: '50', description: 'Minimum base chargeable distance' },
];

export const settingService = {
  async getSettings(): Promise<SystemSetting[]> {
    if (isServiceMock('settings')) {
      await simulateLatency();
      return [...MOCK_SETTINGS];
    }
    return httpRequest<SystemSetting[]>('/api/admin/settings');
  },

  async updateSetting(key: string, value: string | number | boolean): Promise<SystemSetting> {
    if (isServiceMock('settings')) {
      await simulateLatency();
      const item = MOCK_SETTINGS.find((s) => s.settingKey === key);
      if (item) {
        item.settingValue = String(value);
      }
      return item || { settingKey: key, settingValue: String(value) };
    }
    return httpRequest<SystemSetting>(`/api/admin/settings/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    });
  },
};
