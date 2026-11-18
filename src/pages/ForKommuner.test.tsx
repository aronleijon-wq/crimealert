import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { existsSync, readFileSync } from 'node:fs';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/hooks/useSEO', () => ({ useSEO: () => {} }));
vi.mock('@/components/Header', () => ({ default: () => null }));
vi.mock('@/components/Footer', () => ({ default: () => null }));

const renderPage = async () => {
  const { default: ForKommuner } = await import('./ForKommuner');
  return render(<MemoryRouter><ForKommuner /></MemoryRouter>);
};

describe('För kommuner och organisationer', () => {
  it('says what an organisation gets and how to get in touch', async () => {
    await renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Lägesbild över brott och trygghet för ert område' })).toBeInTheDocument();
    for (const title of ['Fokusområden och förslag', 'Lägesrapporter', 'Statistik och jämförelser', 'Data och export']) expect(screen.getByText(title)).toBeInTheDocument();
    const contact = screen.getAllByRole('link', { name: /Kontakta oss|kontakt@crimealert\.se/ });
    expect(contact.length).toBeGreaterThanOrEqual(2);
    for (const link of contact) expect(link.getAttribute('href')).toMatch(/^mailto:kontakt@crimealert\.se/);
  });

  it('links an example report that is published with the site', async () => {
    await renderPage();
    const pdf = screen.getAllByRole('link', { name: /exempelrapport/i })[0].getAttribute('href')!;
    expect(existsSync(`public${pdf}`)).toBe(true);
    const img = screen.getByRole('img', { name: /lägesrapport för Malmö/ });
    expect(existsSync(`public${img.getAttribute('src')}`)).toBe(true);
  });

  it('names the supplier and that no one is identified', async () => {
    await renderPage();
    for (const fact of ['KGV Analysis AB', '559243-8054', 'Karl Gerhards Väg 9, Saltsjöbaden']) expect(screen.getByText(fact)).toBeInTheDocument();
    expect(screen.getByText(/inga namn, åldrar eller exakta adresser/)).toBeInTheDocument();
  });

  it('is in the sitemap and the menus', () => {
    expect(readFileSync('public/sitemap.xml', 'utf8')).toContain('<loc>https://crimealert.se/for-kommuner</loc>');
    expect(readFileSync('src/App.tsx', 'utf8')).toContain('path="/for-kommuner"');
    expect(readFileSync('src/components/landing/LandingNav.tsx', 'utf8')).toContain("to: '/for-kommuner'");
  });
});

describe('the company behind CrimeAlert', () => {
  it('is named in the privacy policy, the terms and both footers', () => {
    for (const file of ['src/pages/Sekretesspolicy.tsx', 'src/pages/Villkor.tsx', 'src/components/Footer.tsx', 'src/components/landing/LandingFooter.tsx']) {
      expect(readFileSync(file, 'utf8'), file).toMatch(/COMPANY/);
    }
    expect(readFileSync('src/pages/Sekretesspolicy.tsx', 'utf8')).toContain('Personuppgiftsansvarig');
    expect(readFileSync('index.html', 'utf8')).toContain('"legalName": "KGV Analysis AB"');
  });
});
