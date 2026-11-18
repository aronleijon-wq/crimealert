import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LandingFooter from './LandingFooter';
import Footer from '@/components/Footer';

describe('the footer', () => {
  it('links to CrimeAlert on social media, in a new tab', () => {
    render(<MemoryRouter><LandingFooter /></MemoryRouter>);
    const expected = {
      Instagram: 'https://www.instagram.com/crimealert.se/',
      TikTok: 'https://www.tiktok.com/@crimealert.se',
      LinkedIn: 'https://www.linkedin.com/company/crimealert/',
    };
    for (const [name, href] of Object.entries(expected)) {
      const link = screen.getByRole('link', { name: `CrimeAlert på ${name}` });
      expect(link).toHaveAttribute('href', href);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
  });
});

describe('the footer on every page', () => {
  it('is the same footer, with the company, the FAQ on the start page and Tyck till', () => {
    render(<MemoryRouter><Footer /></MemoryRouter>);
    expect(screen.getByText(/KGV ANALYSIS AB · ORG.NR 559243-8054/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Vanliga frågor' })).toHaveAttribute('href', '/#vanliga-fragor');
    expect(screen.getByRole('link', { name: 'För kommuner och organisationer' })).toHaveAttribute('href', '/for-kommuner');
    expect(screen.getByRole('button', { name: 'Tyck till' })).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toHaveClass('ca-dark');
  });
});
