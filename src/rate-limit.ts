// Minimal in-memory per-key sliding-window rate limiter.
// Single process only. Not a security boundary against distributed floods,
// but it stops one client from hammering the ingest endpoint.

export class RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private maxHits: number,
    private windowMs: number,
  ) {}

  allow(key: string): { ok: true } | { ok: false; retryAfterSec: number } {
    const now = Date.now();
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.maxHits) {
      this.hits.set(key, recent);
      const retryAfterSec = Math.max(1, Math.ceil((recent[0] + this.windowMs - now) / 1000));
      return { ok: false, retryAfterSec };
    }
    recent.push(now);
    this.hits.set(key, recent);
    // Keep the map bounded: prune when it grows past a sane size.
    if (this.hits.size > 20000) {
      for (const [k, times] of this.hits) {
        if (times.length === 0 || now - times[times.length - 1] >= this.windowMs) this.hits.delete(k);
      }
    }
    return { ok: true };
  }
}
