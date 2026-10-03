import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Incident } from '@/data/mockIncidents';

const minutesAgo = (m: number) => new Date(Date.now() - m * 60 * 1000).toISOString();
const incident = (id: string, area: string, extra: Partial<Incident> = {}): Incident => ({
  id, type: 'fire', title: `02 oktober 12.30, Brand, ${area}`, description: '', lat: 59.86, lng: 17.64,
  area, time: minutesAgo(30), status: 'active', risk: 'high', source: 'Polisen.se', originalType: 'Brand', ...extra,
});

const state = {
  user: null as { id: string } | null,
  kommuner: [] as string[],
  device: { isIos: false, isStandalone: false },
  push: { checked: true, isSubscribed: false, permission: 'default' as NotificationPermission },
  settingsAvailable: true,
  isPremium: false,
};
const addKommun = vi.fn(async () => null);
const removeKommun = vi.fn(async () => null);
const subscribe = vi.fn(async () => true);
const save = vi.fn(async () => true);

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/components/Header', () => ({ default: () => null }));
vi.mock('@/hooks/useSEO', () => ({ useSEO: () => {} }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: state.user, loading: false }) }));
vi.mock('@/hooks/useIsPremium', () => ({ useIsPremium: () => ({ isPremium: state.isPremium, isLoggedIn: !!state.user }) }));
vi.mock('@/hooks/usePoliceEvents', () => ({
  usePoliceEvents: () => ({
    incidents: [
      incident('pol-uppsala', 'Uppsala'),
      incident('pol-lund', 'Lund', { type: 'traffic', risk: 'medium', originalType: 'Trafikolycka', time: minutesAgo(10) }),
    ],
  }),
}));
vi.mock('@/hooks/useNotificationPreferences', () => ({
  useNotificationPreferences: () => ({ kommuner: state.kommuner, loading: false, addKommun, removeKommun }),
}));
vi.mock('@/hooks/useNotificationSettings', () => ({
  useNotificationSettings: () => ({
    settings: { types: ['police', 'fire', 'ambulance', 'traffic', 'other'], minRisk: 'low' },
    available: state.settingsAvailable,
    saving: false,
    save,
  }),
}));
vi.mock('@/hooks/usePushNotifications', () => ({
  usePushNotifications: () => ({
    ...state.push, loading: false, lastError: null, subscribe, unsubscribe: vi.fn(), sendTestNotification: vi.fn(),
  }),
}));
vi.mock('@/lib/push', () => ({ getDevicePushInfo: () => state.device }));

const renderAlerts = async () => {
  const { default: Alerts } = await import('./Alerts');
  return render(<MemoryRouter><Alerts /></MemoryRouter>);
};

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(state, {
    user: { id: 'u1' },
    kommuner: [],
    device: { isIos: false, isStandalone: false },
    push: { checked: true, isSubscribed: false, permission: 'default' },
    settingsAvailable: true,
    isPremium: false,
  });
  Object.defineProperty(navigator, 'serviceWorker', { value: {}, configurable: true });
  Object.assign(window, { PushManager: function PushManager() {}, Notification: function Notification() {} });
});

describe('Alerts page', () => {
  it('invites logged-out visitors to sign up', async () => {
    state.user = null;
    await renderAlerts();
    expect(screen.getByRole('link', { name: /Skapa konto/ })).toHaveAttribute('href', '/auth?mode=signup');
    expect(screen.getByRole('img', { name: 'Exempel på en notis' })).toHaveTextContent('🔥 Brand · Uppsala');
    expect(screen.getByRole('heading', { name: 'Senaste i hela Sverige' })).toBeInTheDocument();
  });

  it('adds a kommun found without accents using the keyboard', async () => {
    await renderAlerts();
    const input = screen.getByRole('combobox', { name: 'Sök kommun att bevaka' });
    fireEvent.change(input, { target: { value: 'malmo' } });
    expect(screen.getByRole('option', { name: /Malmö/ })).toBeInTheDocument();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(addKommun).toHaveBeenCalledWith('Malmö');
  });

  it('only lists events from the watched kommuner, by whole name', async () => {
    state.kommuner = ['Sala', 'Lund'];
    await renderAlerts();
    const mine = screen.getByRole('heading', { name: 'Senaste i dina områden' }).closest('section')!;
    const links = within(mine).getAllByRole('link').filter((a) => a.getAttribute('href')?.startsWith('/karta'));
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/karta?incident=pol-lund']);
    expect(screen.getByText('1 händelse senaste dygnet')).toBeInTheDocument();
    expect(screen.getByText('Lugnt senaste dygnet')).toBeInTheDocument();
  });

  it('walks through the setup and turns notifications on', async () => {
    await renderAlerts();
    expect(screen.getByText('Kom igång med notiser')).toBeInTheDocument();
    expect(screen.getByText('2 steg kvar, sedan får du notiser.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Slå på notiser/ }));
    expect(subscribe).toHaveBeenCalled();
  });

  it('confirms when everything is set up', async () => {
    state.kommuner = ['Uppsala', 'Lund', 'Malmö'];
    state.push.isSubscribed = true;
    await renderAlerts();
    expect(screen.getByText('Notiser är på')).toBeInTheDocument();
    expect(screen.getByText('Du får en notis när något händer i Uppsala, Lund och 1 till.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Skicka testnotis/ })).toBeInTheDocument();
    expect(screen.getByText(/Med gratiskonto kommer notisen 15 minuter efter händelsen/)).toBeInTheDocument();
  });

  it('offers to watch the kommun a kommun page sent the user from', async () => {
    window.history.pushState({}, '', '/alerts?kommun=Malmö');
    await renderAlerts();
    expect(screen.getByText('Vill du bevaka Malmö?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Lägg till' }));
    await vi.waitFor(() => expect(addKommun).toHaveBeenCalledWith('Malmö'));
    await vi.waitFor(() => expect(screen.queryByText('Vill du bevaka Malmö?')).toBeNull());
    window.history.pushState({}, '', '/');
  });

  it('does not mention the free delay to Pro', async () => {
    state.isPremium = true;
    state.kommuner = ['Uppsala'];
    state.push.isSubscribed = true;
    await renderAlerts();
    expect(screen.getByText('Notiser är på')).toBeInTheDocument();
    expect(screen.queryByText(/Med gratiskonto/)).toBeNull();
  });

  it('explains how to install on iPhone first', async () => {
    state.device = { isIos: true, isStandalone: false };
    await renderAlerts();
    expect(screen.getByText(/fungerar notiser bara när CrimeAlert är tillagt på hemskärmen/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Slå på notiser/ })).toBeNull();
  });

  it('explains how to unblock notifications', async () => {
    state.push.permission = 'denied';
    await renderAlerts();
    expect(screen.getByText(/är blockerade i den här webbläsaren/)).toBeInTheDocument();
  });

  it('saves which kinds of events to notify about, keeping at least one', async () => {
    await renderAlerts();
    fireEvent.click(screen.getByRole('switch', { name: /Bränder/ }));
    expect(save).toHaveBeenCalledWith({ types: ['police', 'ambulance', 'traffic', 'other'], minRisk: 'low' });
    fireEvent.click(screen.getByRole('radio', { name: 'Bara allvarligt' }));
    expect(save).toHaveBeenLastCalledWith({ types: ['police', 'fire', 'ambulance', 'traffic', 'other'], minRisk: 'high' });
  });

  it('hides the topic choice when the settings are not available', async () => {
    state.settingsAvailable = false;
    await renderAlerts();
    expect(screen.queryByText('Vad vill du få notiser om?')).toBeNull();
  });
});
