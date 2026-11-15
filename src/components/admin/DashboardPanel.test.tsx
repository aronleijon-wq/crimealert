import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, within } from '@testing-library/react';

const invoke = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }));

import DashboardPanel from './DashboardPanel';

beforeAll(() => {
  // recharts measures its container
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
});

const src = (o: object) => ({ mrr: 0, paying: 0, monthly: 0, yearly: 0, trials: 0, trialMrr: 0, pastDue: 0, endingMrr: 0, ending: 0, ...o });
const data = {
  generated_at: '2026-11-15T16:00:00Z',
  notes: ['Kunde inte läsa Stripe just nu.'],
  revenue: {
    currency: 'sek', mrr: 7600, arr: 91200, netMrr: 5000, newLast30: 2, cancelledLast30: 1, appleTest: 0, otherCurrencies: [],
    stripe: src({ mrr: 3800, paying: 2, monthly: 2 }), apple: src({ mrr: 3800, paying: 2, monthly: 2, trials: 1, trialMrr: 1900 }),
  },
  users: { total: 580, new7: 52, new30: 140, active30: 210, byDay: [{ day: '2026-11-15', count: 8, total: 580 }] },
  devices: { app: 64, web: 120 },
  engagement: { ask7: 85, ask30: 300, push7: 1450, places: 48, reports30: 6, freePro: 3, invited: 5 },
  data: { events24h: 214, eventsTotal: 5455 },
  visits: [{ day: '2026-11-15', mobile: 200, desktop: 80 }],
  ai: {
    answers7: 10, answers30: 40, cost7: 0.12, cost30: 0.5, costAll: 0.5, costPerAnswer: 0.0125,
    byModel: [{ model: 'claude-sonnet-5-5', answers: 10, cost: 0.4 }], byDay: [{ day: '2026-11-15', cost: 0.1, answers: 4 }],
  },
  invites: {
    links: 9, inviters: 1, invited: 2, rewarded: 2, proActive: 1,
    list: [{ email: 'anna@example.se', code: 'ABCD2345', invited: 2, rewarded: 2, pro_until: '2026-11-29T00:00:00Z', pro_active: true, last_invite: '2026-11-14T00:00:00Z' }],
    recent: [{ at: '2026-11-14T00:00:00Z', inviter: 'anna@example.se', invitee: 'bo@example.se', rewarded: true }],
  },
};

describe('DashboardPanel', () => {
  it('shows MRR from Stripe and Apple together, and the other numbers', async () => {
    invoke.mockResolvedValue({ data, error: null });
    render(<DashboardPanel />);
    expect(await screen.findByRole('heading', { name: 'Översikt' })).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledWith('admin-dashboard', { body: {} });
    const mrrRow = screen.getByRole('rowheader', { name: 'MRR' }).closest('tr')!;
    expect(within(mrrRow).getAllByRole('cell').map((c) => c.textContent)).toEqual(['38 kr', '38 kr', '76 kr']);
    expect(screen.getByText('ARR 912 kr')).toBeInTheDocument();
    expect(screen.getByText('Kunde inte läsa Stripe just nu.')).toBeInTheDocument();
    expect(screen.getByText('580')).toBeInTheDocument();
  });

  it("shows the AI chat's cost and who invites friends", async () => {
    invoke.mockResolvedValue({ data, error: null });
    render(<DashboardPanel />);
    // 30 days and all time
    expect(await screen.findAllByText('$0.50')).toHaveLength(2);
    expect(screen.getByText('$0.0125')).toBeInTheDocument();
    expect(screen.getByText('Sonnet 5.5 (Pro)')).toBeInTheDocument();
    const inviter = screen.getByRole('cell', { name: 'anna@example.se' }).closest('tr')!;
    expect(within(inviter).getAllByRole('cell').map((c) => c.textContent)).toEqual(['anna@example.se', '2', '2', '2026-11-29', '2026-11-14']);
    expect(screen.getByText((_, el) => el?.tagName === 'SPAN' && el.textContent === 'anna@example.se bjöd in bo@example.se')).toBeInTheDocument();
  });

  it('says so when the numbers can not be fetched', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error('nope') });
    render(<DashboardPanel />);
    expect(await screen.findByText(/Kunde inte hämta översikten/)).toBeInTheDocument();
  });
});
