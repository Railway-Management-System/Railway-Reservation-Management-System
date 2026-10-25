import { API_CONFIG } from '../config/api.config';
import { ApiErrorEnvelope, ApiSuccessEnvelope } from '../types/api';

export class HttpClientError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(code: string, message: string, status: number = 500, details?: unknown) {
    super(message);
    this.name = 'HttpClientError';
    this.code = code;
    this.status = status;
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
  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (netErr: any) {
    throw new HttpClientError('NETWORK_ERROR', 'Cannot reach the server. Please check that the backend is running.', 0);
  }

  if (response.status === 401) {
    // Clear only admin session, preserve staff session
    localStorage.removeItem(API_CONFIG.STORAGE_KEYS.TOKEN);
    localStorage.removeItem(API_CONFIG.STORAGE_KEYS.USER);
    if (!endpoint.includes('/api/auth/admin/login')) {
      window.dispatchEvent(new CustomEvent('admin:unauthorized', {
        detail: { message: 'Your session has expired or is unauthorized. Please sign in again.' }
      }));
    }
  }

  let body: any;
  try {
    body = (await response.json()) as ApiSuccessEnvelope<T> | ApiErrorEnvelope;
  } catch (parseErr) {
    throw new HttpClientError(`HTTP_${response.status}`, response.statusText || 'Request failed', response.status);
  }

  if (!response.ok || !body.success) {
    const errorBody = body as ApiErrorEnvelope;
    const code = errorBody?.error?.code || `HTTP_${response.status}`;
    let message = errorBody?.error?.message || response.statusText || 'Request failed';
    if (response.status === 401 && endpoint.includes('/api/auth/admin/login')) {
      message = 'Invalid email or password.';
    }
    throw new HttpClientError(code, message, response.status, errorBody?.error?.details);
  }

  return (body as ApiSuccessEnvelope<T>).data;
}

