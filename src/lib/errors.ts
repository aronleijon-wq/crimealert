/** Human-readable message from a thrown value, or '' when there is none. */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null && 'message' in err && typeof err.message === 'string') {
    return err.message;
  }
  return typeof err === 'string' ? err : '';
}

/** Backend errors worth retrying: gateway timeouts and dropped connections. */
export function isTransientBackendError(err: unknown): boolean {
  const e = typeof err === 'object' && err !== null ? (err as { status?: unknown; code?: unknown }) : {};
  const message = getErrorMessage(err).toLowerCase();
  const status = e.status ?? e.code;
  return (
    status === 503 ||
    status === 504 ||
    message.includes('timeout') ||
    message.includes('upstream connect error') ||
    message.includes('failed to fetch')
  );
}
