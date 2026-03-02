/**
 * Stateful rate-limit detector for WCA download processor.
 * Tracks "member not found" HTML lengths to detect anti-bot pages
 * (identical HTML length across multiple responses = rate limiting).
 */
export class RateLimitDetector {
  private notFoundHtmlLengths: number[] = [];
  private _detected = false;

  /** Record a "member not found" response's HTML length. */
  recordNotFound(htmlLength: number): void {
    this.notFoundHtmlLengths.push(htmlLength);
  }

  /** Check if 3+ consecutive "not found" responses have identical HTML length (>1000 chars). */
  isRateLimited(): boolean {
    if (this._detected) return true;
    if (this.notFoundHtmlLengths.length < 3) return false;

    const last3 = this.notFoundHtmlLengths.slice(-3);
    const allSame = last3.every(l => l === last3[0] && l > 1000);
    if (allSame) this._detected = true;
    return this._detected;
  }

  /** Force rate-limit state (e.g. after session verification confirms it). */
  forceDetected(): void {
    this._detected = true;
  }

  get detected(): boolean {
    return this._detected;
  }

  /** Get recent HTML lengths for diagnostic logging. */
  getRecentLengths(n = 3): number[] {
    return this.notFoundHtmlLengths.slice(-n);
  }

  /** Reset state (e.g. between jobs). */
  reset(): void {
    this.notFoundHtmlLengths = [];
    this._detected = false;
  }
}
