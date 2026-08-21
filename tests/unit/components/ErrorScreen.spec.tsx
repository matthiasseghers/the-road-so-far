/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorScreen } from '@/components/ui/ErrorScreen';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ErrorScreen', () => {
  it('renders the message prop', () => {
    render(<ErrorScreen message="Something broke" />);
    expect(screen.getByText('Something broke')).toBeTruthy();
  });

  it('renders the "Try again" button only when onRetry is provided', () => {
    const { rerender } = render(<ErrorScreen />);
    expect(screen.queryByRole('button', { name: /try again/i })).toBeNull();

    rerender(<ErrorScreen onRetry={() => undefined} />);
    expect(screen.getByRole('button', { name: /try again/i })).toBeTruthy();
  });

  it('calls onRetry when the Try again button is clicked', () => {
    const onRetry = vi.fn();
    render(<ErrorScreen onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('renders the "Go back" button only when onGoBack is provided', () => {
    const { rerender } = render(<ErrorScreen />);
    expect(screen.queryByRole('button', { name: /go back/i })).toBeNull();

    rerender(<ErrorScreen onGoBack={() => undefined} />);
    expect(screen.getByRole('button', { name: /go back/i })).toBeTruthy();
  });

  it('calls onGoBack when the Go back button is clicked', () => {
    const onGoBack = vi.fn();
    render(<ErrorScreen onGoBack={onGoBack} />);
    fireEvent.click(screen.getByRole('button', { name: /go back/i }));
    expect(onGoBack).toHaveBeenCalledOnce();
  });

  it('shows neither button when neither callback is provided', () => {
    render(<ErrorScreen message="Error" />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
