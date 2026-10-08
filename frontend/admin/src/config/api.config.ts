/// <reference types="vite/client" />
export const API_CONFIG = {
  USE_MOCK: import.meta.env.VITE_USE_MOCK !== 'false',
  BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000',
  STORAGE_KEYS: {
    TOKEN: 'rrms_admin_token',
    USER: 'rrms_admin_user',
  },
  DEFAULT_MOCK_LATENCY_MS: 300,
} as const;
