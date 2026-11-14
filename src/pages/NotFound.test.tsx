import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const recover = vi.fn();
vi.mock('@/lib/staleBuild', () => ({ recoverFromStaleBuild: () => recover() }));
vi.mock('@/components/Header', () => ({ default: () => null }));
vi.mock('@/hooks/useSEO', () => ({ useSEO: () => {} }));

const { default: NotFound } = await import('./NotFound');
const page = () => render(<MemoryRouter initialEntries={['/fraga']}><NotFound /></MemoryRouter>);
const setController = (controller: object | null) =>
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: controller ? { controller } : undefined });

describe('NotFound', () => {
  afterEach(() => { recover.mockReset(); setController(null); });

  it('loads the site fresh first when an offline copy may be an older version', () => {
    setController({});
    recover.mockReturnValue(true);
    page();
    expect(recover).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Hämtar den senaste versionen av CrimeAlert…')).toBeInTheDocument();
    expect(screen.queryByText('Sidan finns inte')).toBeNull();
  });

  it('says the page is gone when it has just been loaded fresh', () => {
    setController({});
    recover.mockReturnValue(false);
    page();
    expect(screen.getByText('Sidan finns inte')).toBeInTheDocument();
  });

  it('says the page is gone straight away without an offline copy', () => {
    page();
    expect(recover).not.toHaveBeenCalled();
    expect(screen.getByText('Sidan finns inte')).toBeInTheDocument();
  });
});
