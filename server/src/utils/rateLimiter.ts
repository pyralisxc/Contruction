export class RateLimiter {
  private capacity: number
  private tokens: number
  private lastRefill: number
  private refillPerMs: number

  constructor(maxPerMinute: number) {
    this.capacity = Math.max(1, Math.floor(maxPerMinute))
    this.tokens = this.capacity
    this.lastRefill = Date.now()
    this.refillPerMs = this.capacity / 60000
  }

  private refill() {
    const now = Date.now()
    const delta = now - this.lastRefill
    if (delta <= 0) return
    this.tokens = Math.min(this.capacity, this.tokens + delta * this.refillPerMs)
    this.lastRefill = now
  }

  tryRemoveToken() {
    this.refill()
    if (this.tokens >= 1) {
      this.tokens -= 1
      return true
    }
    return false
  }

  async waitForToken(timeoutMs = 5000) {
    const start = Date.now()
    while (!this.tryRemoveToken()) {
      if (Date.now() - start > timeoutMs) return false
      // sleep 100ms
      await new Promise((r) => setTimeout(r, 100))
    }
    return true
  }
}

export default RateLimiter
