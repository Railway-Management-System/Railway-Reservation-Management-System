import { API_CONFIG } from '../config/api.config';
import { ApiErrorEnvelope, ApiSuccessEnvelope } from '../types/api';

export class HttpClientError extends Error {
  code: string;
  details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'HttpClientError';
    this.code = code;
    this.details = details;
  }
}

export async function httpRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem(API_CONFIG.STORAGE_KEYS.TOKEN);
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const url = `${API_CONFIG.BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers,
  });

  const body = (await response.json()) as ApiSuccessEnvelope<T> | ApiErrorEnvelope;

  if (!response.ok || !body.success) {
    const errorBody = body as ApiErrorEnvelope;
    const code = errorBody?.error?.code || `HTTP_${response.status}`;
    const message = errorBody?.error?.message || response.statusText || 'Request failed';
    throw new HttpClientError(code, message, errorBody?.error?.details);
  }

  return (body as ApiSuccessEnvelope<T>).data;
}
