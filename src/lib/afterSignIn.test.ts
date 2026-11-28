import { beforeEach, describe, expect, it } from 'vitest';
import { rememberNext, safeNext, signupUrl, takeNext } from './afterSignIn';

describe('back to the page after signing in', () => {
  beforeEach(() => localStorage.clear());

  it('only goes to pages on this site', () => {
    expect(safeNext('/brottsatlas')).toBe('/brottsatlas');
    expect(safeNext('/analysis?vy=atlas')).toBe('/analysis?vy=atlas');
    expect(safeNext('//evil.se')).toBeNull();
    expect(safeNext('https://evil.se')).toBeNull();
    expect(safeNext('/\\evil.se')).toBeNull();
    expect(safeNext('/auth?mode=signup')).toBeNull();
    expect(safeNext(null)).toBeNull();
  });

  it('remembers the page once, for half an hour', () => {
    rememberNext('/brottsatlas', 1000);
    expect(takeNext(2000)).toBe('/brottsatlas');
    expect(takeNext(3000)).toBeNull();
    rememberNext('/analysis', 0);
    expect(takeNext(31 * 60 * 1000)).toBeNull();
  });

  it('builds the sign-up link', () => {
    expect(signupUrl('/analysis?vy=atlas')).toBe('/auth?mode=signup&next=%2Fanalysis%3Fvy%3Datlas');
  });
});
