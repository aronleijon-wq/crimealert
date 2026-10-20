import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const auth = { user: null as { id: string } | null, loading: false, subscriptionChecked: false };
const premium = { isPremium: false };
const showAds = vi.fn();
const hideAds = vi.fn();

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => auth }));
vi.mock('@/hooks/useIsPremium', () => ({ useIsPremium: () => premium }));
const native = vi.hoisted(() => ({ on: false }));
vi.mock('@/lib/native', () => ({ isNativeApp: () => native.on }));
vi.mock('@/lib/ads', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/ads')>()), showAds, hideAds }));

const renderController = async (path = '/') => {
  const { default: AdsController } = await import('./AdsController');
  return render(<AdsController />, { wrapper: ({ children }) => <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter> });
};

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(auth, { user: null, loading: false, subscriptionChecked: false });
  premium.isPremium = false;
  native.on = false;
});

describe('AdsController', () => {
  it('shows ads to visitors who are not signed in', async () => {
    await renderController();
    expect(showAds).toHaveBeenCalledTimes(1);
  });

  it('does nothing while a signed-in user’s subscription is unknown, then follows it', async () => {
    auth.user = { id: 'u1' };
    const { rerender } = await renderController();
    expect(showAds).not.toHaveBeenCalled();
    expect(hideAds).not.toHaveBeenCalled();

    const { default: AdsController } = await import('./AdsController');
    auth.subscriptionChecked = true;
    premium.isPremium = true;
    rerender(<AdsController />);
    expect(hideAds).toHaveBeenCalledTimes(1);
    expect(showAds).not.toHaveBeenCalled();
  });

  it('keeps ads off screens without our own content, like the map and sign-in', async () => {
    await renderController('/karta');
    await renderController('/auth');
    expect(showAds).not.toHaveBeenCalled();
    expect(hideAds).toHaveBeenCalledTimes(2);
  });

  it('shows ads to signed-in free users once checked', async () => {
    Object.assign(auth, { user: { id: 'u1' }, subscriptionChecked: true });
    await renderController();
    expect(showAds).toHaveBeenCalledTimes(1);
  });

  it('never shows ads in the iPhone app', async () => {
    native.on = true;
    await renderController('/');
    expect(showAds).not.toHaveBeenCalled();
    expect(hideAds).toHaveBeenCalledTimes(1);
  });
});
