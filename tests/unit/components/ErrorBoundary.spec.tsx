/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** A component that unconditionally throws a render error. */
function Bomb({ message }: { message: string }): JSX.Element {
  throw new Error(message);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // Suppress React's internal error logging for expected boundary catches
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('renders children normally when no error is thrown', () => {
    render(
      <ErrorBoundary>
        <span>All good</span>
      </ErrorBoundary>,
    );
    expect(screen.getByText('All good')).toBeTruthy();
  });

  it('renders ErrorScreen when a child throws a render error', () => {
    render(
      <ErrorBoundary>
        <Bomb message="Render crashed" />
      </ErrorBoundary>,
    );
    // ErrorScreen always shows "Something went wrong" heading
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    // And the specific error message
    expect(screen.getByText('Render crashed')).toBeTruthy();
  });

  it('renders a "Try again" button that calls window.location.reload', () => {
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { reload: reloadMock },
      writable: true,
      configurable: true,
    });

    render(
      <ErrorBoundary>
        <Bomb message="Oops" />
      </ErrorBoundary>,
    );

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(reloadMock).toHaveBeenCalledOnce();
  });
});
