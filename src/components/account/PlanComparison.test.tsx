import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PlanComparison from './PlanComparison';
import { PRICES, PRO_FEATURES, YEARLY_DISCOUNT_PERCENT } from './plans';
import { FREE_TIER_DELAY_MS } from '@/lib/mapFilters';

const renderPlans = (props: Partial<React.ComponentProps<typeof PlanComparison>> = {}) => {
  const handlers = { onBillingCycle: vi.fn(), onCheckout: vi.fn(), onManage: vi.fn() };
  render(
    <MemoryRouter>
      <PlanComparison signedIn={false} isPremium={false} billingCycle="monthly" checkoutLoading={false} {...handlers} {...props} />
    </MemoryRouter>,
  );
  return handlers;
};

describe('PlanComparison', () => {
  it('invites visitors to a free account and to Pro', () => {
    const { onCheckout } = renderPlans();
    expect(screen.getByRole('link', { name: 'Skapa gratis konto' })).toHaveAttribute('href', '/auth?mode=signup');
    fireEvent.click(screen.getByRole('button', { name: 'Uppgradera till Pro' }));
    expect(onCheckout).toHaveBeenCalled();
  });

  it('marks the current plan and lets Pro manage the subscription', () => {
    const { onManage } = renderPlans({ signedIn: true, isPremium: true });
    expect(screen.getByText('Ingår i Pro')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Hantera prenumeration' }));
    expect(onManage).toHaveBeenCalled();
  });

  it('switches between monthly and yearly prices', () => {
    const { onBillingCycle } = renderPlans({ billingCycle: 'yearly' });
    expect(screen.getByText('159 kr')).toBeInTheDocument();
    expect(screen.getByText('Spara 69 kr jämfört med månadsvis')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Årsvis −30%/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Månadsvis' }));
    expect(onBillingCycle).toHaveBeenCalledWith('monthly');
  });

  it('compares the plans row by row', () => {
    renderPlans();
    const table = screen.getByRole('table', { name: 'Jämför Gratis och Pro' });
    const row = (name: string) => within(table).getByRole('rowheader', { name }).closest('tr')!;
    expect(within(row('Polisens händelser på kartan och i flödet')).getAllByRole('cell').map((c) => c.textContent)).toEqual(['15 min fördröjning', 'Direkt']);
    expect(within(row('VMA och krisinformation')).getAllByRole('cell').map((c) => c.textContent)).toEqual(['Direkt', 'Direkt']);
    expect(within(row('Medborgarrapporter')).getByLabelText('Ingår inte')).toBeInTheDocument();
    expect(within(row('Reklam')).getAllByRole('cell').map((c) => c.textContent)).toEqual(['Visas', 'Ingen']);
  });
});

describe('plan texts match the code', () => {
  it('states the free delay the map and police-events use', () => {
    expect(FREE_TIER_DELAY_MS).toBe(15 * 60 * 1000);
    expect(PRO_FEATURES[0].text).toContain('15 minuters');
  });

  it('gives 30 % off for a year', () => {
    expect(PRICES.monthly.price).toBe('19 kr');
    expect(PRICES.yearly.price).toBe('159 kr');
    expect(YEARLY_DISCOUNT_PERCENT).toBe(30);
    expect(PRICES.yearly.note).toBe('Spara 69 kr jämfört med månadsvis');
  });
});
