import { describe, it, expect } from 'vitest';
import { getErrorMessage, isTransientBackendError } from './errors';

describe('getErrorMessage', () => {
  it('reads the message from errors and error-like objects', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom');
    expect(getErrorMessage({ message: 'från servern' })).toBe('från servern');
    expect(getErrorMessage('plain string')).toBe('plain string');
  });

  it('returns an empty string when there is no message, so callers can fall back', () => {
    expect(getErrorMessage(null)).toBe('');
    expect(getErrorMessage({ code: 500 })).toBe('');
    expect(getErrorMessage(42)).toBe('');
  });
});

describe('isTransientBackendError', () => {
  it('treats gateway timeouts and dropped connections as transient', () => {
    expect(isTransientBackendError({ status: 503 })).toBe(true);
    expect(isTransientBackendError({ code: 504 })).toBe(true);
    expect(isTransientBackendError(new TypeError('Failed to fetch'))).toBe(true);
    expect(isTransientBackendError(new Error('upstream connect error or disconnect'))).toBe(true);
  });

  it('does not retry real auth errors', () => {
    expect(isTransientBackendError({ status: 400, message: 'Invalid login credentials' })).toBe(false);
    expect(isTransientBackendError(null)).toBe(false);
  });
});
