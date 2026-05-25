import { config } from "../config";

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Classify an error as transient (worth retrying) or permanent.
 * Retries: network failures, timeouts, HTTP 429, and 5xx responses.
 * Does NOT retry: 4xx client errors (except 429), content parsing errors.
 */
function isTransientError(err: unknown): boolean {
  if (err instanceof TypeError && err.message === "fetch failed") return true;
  if (err instanceof DOMException && err.name === "TimeoutError") return true;
  if (err instanceof Error) {
    // AbortError from AbortSignal.timeout
    if (err.name === "TimeoutError") return true;
    // ECONNREFUSED, ENOTFOUND, etc.
    if ("code" in err && typeof (err as NodeJS.ErrnoException).code === "string") return true;
    // HTTP status errors — retry on 429 and 5xx only
    const statusMatch = err.message.match(/API error:\s*(\d+)/);
    if (statusMatch) {
      const status = Number(statusMatch[1]);
      return status === 429 || status >= 500;
    }
  }
  return false;
}

/**
 * Retry wrapper for async operations that may fail transiently.
 * Up to 2 retries (3 total attempts), 1s delay between attempts.
 * Only retries on transient errors — 4xx (except 429) and content errors
 * propagate immediately.
 */
export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < MAX_ATTEMPTS && isTransientError(err)) {
        if (config.llmDebug) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(
            `[llm:retry] attempt ${attempt}/${MAX_ATTEMPTS} failed (${msg}), retrying in ${RETRY_DELAY_MS}ms…`
          );
        }
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}