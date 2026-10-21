const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';
let csrfToken: string | null = null;

export function setCsrfToken(token: string | null): void { csrfToken = token; }

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

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase();
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && csrfToken) headers.set('X-CSRF-Token', csrfToken);
  const response = await fetch(`${API_BASE}${path}`, { ...options, method, headers, credentials: 'include' });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as unknown;
    const message = readableErrorMessage(body, response.status);
    throw new ApiError(message, response.status, body);
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
