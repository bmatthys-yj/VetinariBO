import type { MiddlewareHandler } from "hono";

export interface RateLimitOptions {
  /** Requests allowed per window, per client. */
  readonly limit: number;
  /** Window length in milliseconds. */
  readonly windowMs: number;
  /**
   * Trust `x-forwarded-for` to identify the client.
   *
   * Only enable behind a proxy you control: the header is trivially spoofed, so
   * trusting it on a directly exposed server lets any caller evade the limit.
   */
  readonly trustProxy?: boolean;
}

/**
 * A small fixed-window rate limiter held in memory.
 *
 * It resets on restart and is per-process, so it would not survive a move to
 * several instances. That is enough to blunt casual abuse of a public form
 * without taking on a dependency or a shared store.
 */
export function rateLimit(options: RateLimitOptions): MiddlewareHandler {
  const hits = new Map<string, { count: number; resetAt: number }>();

  function clientKey(header: string | undefined, remote: string | undefined): string {
    if (options.trustProxy && header) {
      const first = header.split(",")[0]?.trim();
      if (first) return first;
    }
    return remote ?? "unknown";
  }

  return async (context, next) => {
    const now = Date.now();

    // Drop expired entries so the map cannot grow without bound.
    for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key);

    const remote = context.env?.incoming?.socket?.remoteAddress as string | undefined;
    const key = clientKey(context.req.header("x-forwarded-for"), remote);
    const entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + options.windowMs });
      return next();
    }
    if (entry.count >= options.limit) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      return context.text("Too many requests. Please try again shortly.", 429, {
        "retry-after": `${retryAfter}`,
      });
    }
    entry.count += 1;
    return next();
  };
}
