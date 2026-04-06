import type { Result, AppError } from '@/types/domain';

// ─── Constructors ─────────────────────────────────────────────────────────────

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function err<E extends AppError = AppError>(error: E): Result<never, E> {
  return { ok: false, error };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T } {
  return result.ok;
}

export function isErr<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
  return !result.ok;
}

export function unwrap<T>(result: Result<T>): T {
  if (result.ok) return result.value;
  throw new Error(`unwrap called on Err: ${result.error.message}`);
}

export function unwrapOr<T>(result: Result<T>, fallback: T): T {
  return result.ok ? result.value : fallback;
}
