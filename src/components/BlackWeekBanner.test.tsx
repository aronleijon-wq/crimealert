import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, renderHook, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const auth: { user: { id: string } | null; subscription: { trialEligible?: boolean } } = { user: null, subscription: {} };
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => auth }));

const { useBlackWeekBanner } = await import('@/hooks/useBlackWeekBanner');
const { default: BlackWeekBanner } = await import('./BlackWeekBanner');

const MON = Date.parse('2026-11-23T20:00:00+01:00');
const DEC = Date.parse('2026-12-01T00:00:00+01:00');

const Strip = ({ now }: { now: number }) => {
  const banner = useBlackWeekBanner(now);
  return banner.visible ? <BlackWeekBanner banner={banner} /> : null;
};
const show = (now = MON) => render(<MemoryRouter><Strip now={now} /></MemoryRouter>);

beforeEach(() => { localStorage.clear(); auth.user = null; auth.subscription = {}; });
afterEach(() => vi.restoreAllMocks());

describe('the Black Week strip', () => {
  it('offers 30 days of Pro free to visitors, with the days left, and links to the plans', () => {
    show();
    expect(screen.getByText('Black Week')).toBeInTheDocument();
    expect(screen.getByText((_, el) => el?.textContent === '30 dagar Pro gratis' && el.tagName === 'SPAN')).toBeInTheDocument();
    expect(screen.getByText(/8 dagar kvar/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Prova gratis/ })).toHaveAttribute('href', '/prisplan');
  });

  it('offers 7 days per friend to those who have had Pro', () => {
    auth.user = { id: 'u1' };
    auth.subscription = { trialEligible: false };
    show();
    expect(screen.getByText((_, el) => el?.textContent === '7 dagar Pro per vän du bjuder in' && el.tagName === 'SPAN')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Bjud in/ })).toHaveAttribute('href', '/installningar#bjud-in');
  });

  it('says it is the last day on 30 November, and is gone from 1 December', () => {
    show(Date.parse('2026-11-30T18:00:00+01:00'));
    expect(screen.getByText(/sista dagen/)).toBeInTheDocument();
    const { container } = show(DEC);
    expect(container).toBeEmptyDOMElement();
  });

  it('closes for good with one tap', () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Stäng erbjudandet' }));
    expect(screen.queryByText('Black Week')).toBeNull();
    const { result } = renderHook(() => useBlackWeekBanner(MON), { wrapper: MemoryRouter });
    expect(result.current.visible).toBe(false);
  });
});
