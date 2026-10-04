import { describe, it, expect } from 'vitest';
import { returnOrigin, SITE_ORIGIN } from './returnOrigin';

describe('returnOrigin', () => {
  it('keeps our own sites', () => {
    for (const origin of [
      'https://crimealert.se',
      'https://www.crimealert.se',
      'https://crimealert.lovable.app',
      'https://preview--crimealert.lovable.app',
      'https://id-preview--c9c5629c-ccab-4cdc-9797-2cb282162906.lovable.app',
      'https://c9c5629c-ccab-4cdc-9797-2cb282162906.lovableproject.com',
      'http://localhost:8080',
      'http://127.0.0.1:5173',
    ]) {
      expect(returnOrigin(origin)).toBe(origin);
    }
  });

  it('sends everything else to the live site', () => {
    for (const origin of [
      'https://crimealert-login.lovable.app', // another Lovable project
      'https://crimealert.se.evil.com',
      'https://evilcrimealert.se',
      'https://crimealert.se/path',
      'https://crimealert.se@evil.com',
      'http://crimealert.se', // not https
      'https://id-preview--00000000-0000-0000-0000-000000000000.lovable.app',
      'null',
      '',
      null,
      undefined,
    ]) {
      expect(returnOrigin(origin)).toBe(SITE_ORIGIN);
    }
  });
});
