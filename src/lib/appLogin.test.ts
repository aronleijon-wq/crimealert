import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const auth = vi.hoisted(() => ({ listener: null as null | ((event: string, session: unknown) => void), unsubscribe: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      onAuthStateChange: (listener: (event: string, session: unknown) => void) => {
        auth.listener = listener;
        return { data: { subscription: { unsubscribe: auth.unsubscribe } } };
      },
    },
  },
}));

const { appErrorUrl, handOverAppLogin, inSignInSheet, returnedError, startAppLogin } = await import('./appLogin');

const replace = vi.fn();
const visit = (href: string) => vi.stubGlobal('location', { href, pathname: new URL(href).pathname, replace });

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  replace.mockClear();
  auth.listener = null;
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('the app sign-in sheet', () => {
  it('knows it is the sheet from either storage, for a while', () => {
    expect(inSignInSheet()).toBe(false);
    startAppLogin();
    sessionStorage.clear();
    expect(inSignInSheet()).toBe(true);
    expect(inSignInSheet(Date.now() + 16 * 60 * 1000)).toBe(false);
  });

  it('reads an error from the return address', () => {
    expect(returnedError('https://crimealert.se/?error=access_denied&error_description=User+cancelled')).toBe('User cancelled');
    expect(returnedError('https://crimealert.se/#error=server_error')).toBe('server_error');
    expect(returnedError('https://crimealert.se/#access_token=a&refresh_token=b')).toBeNull();
  });

  it('hands the session to the app and shows a way back if the sheet stays open', () => {
    startAppLogin();
    visit('https://crimealert.se/');
    handOverAppLogin();
    auth.listener?.('INITIAL_SESSION', { access_token: 'a', refresh_token: 'b' });
    expect(replace).toHaveBeenCalledWith('crimealert://auth#access_token=a&refresh_token=b');
    expect(inSignInSheet()).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(document.querySelector('a')?.getAttribute('href')).toBe('crimealert://auth#access_token=a&refresh_token=b');
  });

  it('returns to the app with the reason when the sign-in failed or never finished', () => {
    startAppLogin();
    visit('https://crimealert.se/?error=access_denied');
    handOverAppLogin();
    expect(replace).toHaveBeenCalledWith(appErrorUrl('access_denied'));

    replace.mockClear();
    startAppLogin();
    visit('https://crimealert.se/');
    handOverAppLogin();
    auth.listener?.('INITIAL_SESSION', null);
    expect(replace).not.toHaveBeenCalled();
    vi.advanceTimersByTime(5000);
    expect(replace).toHaveBeenCalledWith(expect.stringMatching(/^crimealert:\/\/auth#error=/));
  });

  it('leaves the website alone', () => {
    visit('https://crimealert.se/');
    handOverAppLogin();
    expect(auth.listener).toBeNull();
    startAppLogin();
    visit('https://crimealert.se/app-login?provider=apple');
    handOverAppLogin();
    expect(auth.listener).toBeNull();
  });
});
