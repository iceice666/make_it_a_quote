type RateLimitEntry = {
  count: number;
  resetAt: number;
};

export class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number = 10, windowSeconds: number = 60) {
    this.maxRequests = maxRequests;
    this.windowMs = windowSeconds * 1000;
  }

  isAllowed(identifier: string): boolean {
    const now = Date.now();
    const entry = this.limits.get(identifier);

    if (!entry || now > entry.resetAt) {
      this.limits.set(identifier, {
        count: 1,
        resetAt: now + this.windowMs,
      });
      return true;
    }

    if (entry.count >= this.maxRequests) {
      return false;
    }

    entry.count++;
    return true;
  }

  getRemaining(identifier: string): number {
    const entry = this.limits.get(identifier);
    if (!entry || Date.now() > entry.resetAt) {
      return this.maxRequests;
    }
    return Math.max(0, this.maxRequests - entry.count);
  }

  getRetryAfter(identifier: string): number | null {
    const entry = this.limits.get(identifier);
    if (!entry) return null;
    const now = Date.now();
    if (now > entry.resetAt) return null;
    return Math.ceil((entry.resetAt - now) / 1000);
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.limits) {
      if (now > entry.resetAt) {
        this.limits.delete(key);
      }
    }
  }

  get size(): number {
    return this.limits.size;
  }
}
