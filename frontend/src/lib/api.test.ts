import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from './api';

afterEach(() => vi.unstubAllGlobals());

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
