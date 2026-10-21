import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, setCsrfToken } from './api';

afterEach(() => {
  setCsrfToken(null);
  vi.unstubAllGlobals();
});

describe('api error messages', () => {
  it('formats FastAPI validation details into safe field-specific text', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ detail: [{ type: 'extra_forbidden', loc: ['body', 'confirmPassword'], msg: 'Extra inputs are not permitted', input: 'must-not-be-shown' }] }),
    }));

    await expect(api('/auth/signup', { method: 'POST', body: '{}' })).rejects.toMatchObject({
      name: 'ApiError',
      status: 422,
      message: 'confirmPassword: Extra inputs are not permitted',
    } satisfies Partial<ApiError>);
  });

  it('uses a plain fallback for unrecognized object error envelopes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ detail: { code: 'unexpected' } }),
    }));

    await expect(api('/auth/signup')).rejects.toMatchObject({ message: 'Request failed (500)' });
  });
});

describe('API CSRF handling', () => {
  it('sends the in-memory CSRF token for state-changing requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      headers: { get: () => 'application/json' },
      json: async () => ({ id: 'project-1' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    setCsrfToken('csrf-test-token');

    await api('/projects', { method: 'POST', body: JSON.stringify({ name: 'Test' }) });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(init.headers).get('X-CSRF-Token')).toBe('csrf-test-token');
  });

  it('refreshes and retries once after the backend explicitly rejects the CSRF token', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ detail: 'CSRF token missing or invalid' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ csrf_token: 'csrf-refreshed-token' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: { get: () => 'application/json' },
        json: async () => ({ id: 'project-2' }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const result = await api<{ id: string }>('/projects', { method: 'POST', body: JSON.stringify({ name: 'Test' }) });

    expect(result.id).toBe('project-2');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/auth/csrf');
    const retryInit = fetchMock.mock.calls[2]?.[1] as RequestInit;
    expect(new Headers(retryInit.headers).get('X-CSRF-Token')).toBe('csrf-refreshed-token');
  });
});
