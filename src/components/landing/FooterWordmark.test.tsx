import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import FooterWordmark from './FooterWordmark';

describe('the big CRIMEALERT at the bottom', () => {
  it('draws the word for the eye only, with the status line and Swedish time', () => {
    const { container } = render(<FooterWordmark />);
    const svg = container.querySelector('svg')!;
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect([...svg.querySelectorAll('text')].map((t) => t.textContent)).toContain('ALERT');
    expect(screen.getByText(/LIVE · LÄGESBILD SVERIGE/)).toBeInTheDocument();
    expect(screen.getByLabelText('Svensk tid').textContent).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });
});
