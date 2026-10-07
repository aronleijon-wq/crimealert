import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/hooks/useSEO', () => ({ useSEO: () => {} }));
vi.mock('@/components/Header', () => ({ default: () => null }));
vi.mock('@/components/Footer', () => ({ default: () => null }));

const renderPage = async () => {
  const { default: OmOss } = await import('./OmOss');
  return render(<MemoryRouter><OmOss /></MemoryRouter>);
};

describe('Om oss', () => {
  it('names the founder and what CrimeAlert strives for', async () => {
    await renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Om oss' })).toBeInTheDocument();
    // In the text, not in a caption of its own
    expect(screen.getByText('Aron Leijon').closest('p')).toHaveTextContent(/^Bakom CrimeAlert står grundaren Aron Leijon, och idén är enkel/);
    expect(screen.queryByText('Grundare, CrimeAlert')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Vad vi strävar efter' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Trygghet genom kunskap', 'Fakta, inte rykten', 'Öppet för alla']);
    expect(screen.getByText(/inte en del av Polisen/)).toBeInTheDocument();
  });

  it('asks for feedback by mail and on Trustpilot', async () => {
    await renderPage();
    expect(screen.getByText(/Vi ser alltid fram emot feedback och åsikter om sidan/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /crimealert\.swe@gmail\.com/ })).toHaveAttribute('href', 'mailto:crimealert.swe@gmail.com');
    const trustpilot = screen.getByRole('link', { name: /Trustpilot/ });
    expect(trustpilot).toHaveAttribute('href', 'https://se.trustpilot.com/evaluate/crimealert.se');
    expect(trustpilot).toHaveAttribute('target', '_blank');
  });

  it('shows no made-up event count', async () => {
    const { container } = await renderPage();
    expect(container.textContent).not.toMatch(/händelser loggade/);
  });

  it('tells search engines who runs CrimeAlert', async () => {
    const { container } = await renderPage();
    const ld = JSON.parse(container.querySelector('script[type="application/ld+json"]')!.textContent!);
    expect(ld['@type']).toBe('AboutPage');
    expect(ld.mainEntity.founder).toEqual({ '@type': 'Person', name: 'Aron Leijon', jobTitle: 'Grundare' });
  });

  it('is in the sitemap', () => {
    expect(readFileSync('public/sitemap.xml', 'utf8')).toContain('<loc>https://crimealert.se/om-oss</loc>');
  });
});
