import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ErrorBoundary from '@/components/ErrorBoundary';
import { pagePattern } from './monitoring';

describe('pagePattern', () => {
  it('names pages, not the people or events on them', () => {
    expect(pagePattern('/kommun/malmo')).toBe('/kommun/:slug');
    expect(pagePattern('/handelse/612345?x=1')).toBe('/handelse/:id');
    expect(pagePattern('/karta?incident=5')).toBe('/karta');
    expect(pagePattern('/flode/')).toBe('/flode');
    expect(pagePattern('/')).toBe('/');
  });
});

describe('ErrorBoundary', () => {
  it('shows a way back instead of a blank page', () => {
    const Broken = () => { throw new Error('trasig'); };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ErrorBoundary><Broken /></ErrorBoundary>);
    expect(screen.getByText('Något gick fel')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ladda om' })).toBeInTheDocument();
    spy.mockRestore();
  });
});
