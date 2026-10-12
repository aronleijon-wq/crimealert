import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';

vi.mock('@/hooks/useSEO', () => ({ useSEO: () => {} }));
vi.mock('@/components/Header', () => ({ default: () => null }));
vi.mock('@/components/Footer', () => ({ default: () => null }));

const renderPage = async () => {
  const { default: Statistik } = await import('./Statistik');
  return render(<MemoryRouter><Statistik /></MemoryRouter>);
};

describe('Statistik', () => {
  it('shows shootings, explosions and reported crimes with their numbers', async () => {
    await renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Brottsutvecklingen i Sverige' })).toBeInTheDocument();
    const shootings = screen.getByRole('heading', { level: 2, name: 'Skjutningar' }).closest('section')!;
    const rows = within(shootings).getAllByRole('row').map((r) => r.textContent);
    // År, skjutningar, döda, skadade
    expect(rows).toEqual(['ÅrSkjutningarDödaSkadade', '202336854108', '20242704457', '20251584644']);
    expect(within(shootings).getByRole('img', { name: /Skjutningar per år: 2023 368, 2024 270, 2025 158/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Sprängningar' })).toBeInTheDocument();
    const reported = screen.getByRole('heading', { level: 2, name: 'Anmälda brott' }).closest('section')!;
    expect(within(reported).getByRole('img', { name: /^Bostadsinbrott: 10\s427 år 2024, 8\s820 år 2025$/ })).toBeInTheDocument();
  });

  it('links every figure to Polisen or Brå', async () => {
    await renderPage();
    const sources = screen.getAllByRole('link').filter((a) => a.getAttribute('target') === '_blank');
    expect(sources.length).toBeGreaterThanOrEqual(4);
    for (const a of sources) expect(a.getAttribute('href')).toMatch(/^https:\/\/(polisen|bra)\.se\//);
  });

  it('is in the sitemap', () => {
    expect(readFileSync('public/sitemap.xml', 'utf8')).toContain('<loc>https://crimealert.se/statistik</loc>');
  });
});
