import { describe, expect, it } from 'vitest';
import { signupRequestPayload } from './payload';

describe('signupRequestPayload', () => {
  it('sends only fields accepted by the backend signup schema', () => {
    expect(signupRequestPayload({
      name: 'Ada Example',
      email: 'ada@example.com',
      password: 'secure-password-123',
      confirmPassword: 'secure-password-123',
    })).toEqual({
      name: 'Ada Example',
      email: 'ada@example.com',
      password: 'secure-password-123',
    });
  });
});
