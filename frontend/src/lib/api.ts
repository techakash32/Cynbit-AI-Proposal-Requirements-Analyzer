const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';
let csrfToken: string | null = null;

export function setCsrfToken(token: string | null): void { csrfToken = token; }

function readCsrfCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const entry = document.cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith('cynbit_csrf='));
  if (!entry) return null;
  const value = entry.slice('cynbit_csrf='.length);
  try { return decodeURIComponent(value) || null; } catch { return value || null; }
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body?: unknown) {
    super(message); this.name = 'ApiError'; this.status = status; this.body = body;
  }
}

function readableErrorMessage(body: unknown, status: number): string {
  const describe = (value: unknown): string | undefined => {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (Array.isArray(value)) {
      const issues = value.map((item) => {
        if (typeof item === 'string' && item.trim()) return item.trim();
        if (item === null || typeof item !== 'object' || Array.isArray(item)) return undefined;
        const issue = item as Record<string, unknown>;
        const message = typeof issue.msg === 'string' ? issue.msg : typeof issue.message === 'string' ? issue.message : undefined;
        if (!message) return undefined;
        const location = Array.isArray(issue.loc) ? issue.loc.filter((part): part is string | number => typeof part === 'string' || typeof part === 'number') : [];
        const path = ['body', 'query', 'path', 'header', 'cookie'].includes(String(location[0])) ? location.slice(1).join('.') : location.join('.');
        return path ? `${path}: ${message}` : message;
      }).filter((message): message is string => Boolean(message));
      return issues.length ? issues.join('; ') : undefined;
    }
    if (value !== null && typeof value === 'object') {
      const envelope = value as Record<string, unknown>;
      for (const key of ['message', 'msg', 'title', 'error']) {
        const candidate = envelope[key];
        if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
      }
    }
    return undefined;
  };

  if (body !== null && typeof body === 'object' && !Array.isArray(body)) {
    const envelope = body as Record<string, unknown>;
    return describe(envelope.detail) ?? describe(envelope.message) ?? `Request failed (${status})`;
  }
  return `Request failed (${status})`;
}

function isCsrfRejection(body: unknown): boolean {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return false;
  return (body as Record<string, unknown>).detail === 'CSRF token missing or invalid';
}

async function refreshCsrfToken(): Promise<string | null> {
  try {
    const response = await fetch(`${API_BASE}/auth/csrf`, { method: 'POST', credentials: 'include' });
    if (!response.ok) return null;
    const session = await response.json() as { csrf_token?: unknown };
    if (typeof session.csrf_token !== 'string' || !session.csrf_token) return null;
    csrfToken = session.csrf_token;
    return session.csrf_token;
  } catch {
    return null;
  }
}

async function send(path: string, options: RequestInit, method: string, tokenOverride?: string): Promise<Response> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const token = tokenOverride ?? readCsrfCookie() ?? csrfToken;
    if (token) headers.set('X-CSRF-Token', token);
  }
  return fetch(`${API_BASE}${path}`, { ...options, method, headers, credentials: 'include' });
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase();
  let response = await send(path, options, method);
  let errorBody: unknown = null;

  if (!response.ok) {
    errorBody = await response.json().catch(() => null) as unknown;
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && isCsrfRejection(errorBody)) {
      const refreshedToken = await refreshCsrfToken();
      if (refreshedToken) {
        response = await send(path, options, method, refreshedToken);
        errorBody = response.ok ? null : await response.json().catch(() => null) as unknown;
      }
    }
  }

  if (!response.ok) {
    const message = readableErrorMessage(errorBody, response.status);
    throw new ApiError(message, response.status, errorBody);
  }
  if (response.status === 204) return undefined as T;
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return response as T;
  return response.json() as Promise<T>;
}

export async function download(path: string, filename: string): Promise<void> {
  const response = await api<Response>(path);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.click();
  URL.revokeObjectURL(url);
}
