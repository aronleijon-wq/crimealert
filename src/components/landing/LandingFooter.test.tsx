import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LandingFooter from './LandingFooter';

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
