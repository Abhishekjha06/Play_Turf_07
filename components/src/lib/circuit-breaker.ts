/**
 * Circuit breaker for protecting against cascading frontend failures.
 *
 * Trips when a dependency (Supabase, payment gateway, etc.) exceeds
 * failure/slow thresholds. Fast-fails subsequent requests with a
 * configurable fallback until the dependency recovers.
 */

export type CircuitState = "closed" | "open" | "half_open";

export interface CircuitBreakerConfig {
  /** Trip after this many failures within the window */
  failureThreshold?: number;
  /** Time window (ms) for counting failures */
  failureWindowMs?: number;
  /** How long to stay OPEN before trying HALF_OPEN */
  recoveryTimeoutMs?: number;
  /** Half-open: allow this many test requests */
  halfOpenMaxCalls?: number;
  /** Slow-call threshold (ms) — counts as failure */
  slowCallThresholdMs?: number;
  /** Max concurrent requests to this dependency */
  maxConcurrency?: number;
}

interface CircuitRecord {
  failures: number[];
  state: CircuitState;
  openedAt: number;
  halfOpenCalls: number;
  concurrency: number;
}

export class CircuitBreakerError extends Error {
  constructor(
    message: string,
    public readonly circuitName: string,
    public readonly state: CircuitState
  ) {
    super(message);
    this.name = "CircuitBreakerError";
  }
}

export class CircuitBreaker {
  private readonly config: Required<CircuitBreakerConfig>;
  private readonly record: CircuitRecord;

  constructor(
    public readonly name: string,
    config: CircuitBreakerConfig = {}
  ) {
    this.config = {
      failureThreshold: config.failureThreshold ?? 5,
      failureWindowMs: config.failureWindowMs ?? 60_000,
      recoveryTimeoutMs: config.recoveryTimeoutMs ?? 30_000,
      halfOpenMaxCalls: config.halfOpenMaxCalls ?? 3,
      slowCallThresholdMs: config.slowCallThresholdMs ?? 8_000,
      maxConcurrency: config.maxConcurrency ?? 20,
    };
    this.record = {
      failures: [],
      state: "closed",
      openedAt: 0,
      halfOpenCalls: 0,
      concurrency: 0,
    };
  }

  private now(): number {
    return performance.now();
  }

  private trimFailures(): void {
    const cutoff = this.now() - this.config.failureWindowMs;
    this.record.failures = this.record.failures.filter((f) => f > cutoff);
  }

  private shouldTrip(): boolean {
    this.trimFailures();
    return this.record.failures.length >= this.config.failureThreshold;
  }

  /**
   * Execute an async function through the circuit breaker.
   * Returns the function result, or throws CircuitBreakerError if open.
   */
  async call<T>(fn: () => Promise<T>, fallback?: () => T): Promise<T> {
    // Concurrency limit
    if (this.record.concurrency >= this.config.maxConcurrency) {
      if (fallback) return fallback();
      throw new CircuitBreakerError(
        `Circuit '${this.name}' concurrency limit exceeded (${this.config.maxConcurrency})`,
        this.name,
        this.record.state
      );
    }

    // State machine
    if (this.record.state === "open") {
      if (this.now() - this.record.openedAt >= this.config.recoveryTimeoutMs) {
        this.record.state = "half_open";
        this.record.halfOpenCalls = 0;
      } else {
        if (fallback) return fallback();
        throw new CircuitBreakerError(
          `Circuit '${this.name}' is OPEN — dependency unavailable.`,
          this.name,
          this.record.state
        );
      }
    }

    if (this.record.state === "half_open") {
      if (this.record.halfOpenCalls >= this.config.halfOpenMaxCalls) {
        if (fallback) return fallback();
        throw new CircuitBreakerError(
          `Circuit '${this.name}' is HALF_OPEN — test quota exhausted.`,
          this.name,
          this.record.state
        );
      }
      this.record.halfOpenCalls++;
    }

    this.record.concurrency++;
    const start = this.now();

    try {
      const result = await fn();
      const elapsed = this.now() - start;

      // Slow call counts as failure
      if (elapsed > this.config.slowCallThresholdMs) {
        this.recordFailure();
      } else {
        this.recordSuccess();
      }

      return result;
    } catch (error) {
      this.recordFailure();
      if (fallback) {
        try {
          return fallback();
        } catch (fallbackError) {
          throw new CircuitBreakerError(
            `Circuit '${this.name}' fallback also failed: ${fallbackError}`,
            this.name,
            this.record.state
          );
        }
      }
      throw new CircuitBreakerError(
        `Circuit '${this.name}' recorded failure: ${error}`,
        this.name,
        this.record.state
      );
    } finally {
      this.record.concurrency = Math.max(0, this.record.concurrency - 1);
    }
  }

  private recordFailure(): void {
    this.record.failures.push(this.now());
    this.trimFailures();
    if (this.shouldTrip() && this.record.state !== "open") {
      this.record.state = "open";
      this.record.openedAt = this.now();
      this.record.halfOpenCalls = 0;
      console.warn(`[CircuitBreaker] '${this.name}' tripped OPEN after ${this.config.failureThreshold} failures`);
    }
  }

  private recordSuccess(): void {
    if (this.record.state === "half_open") {
      this.record.state = "closed";
      this.record.failures = [];
      this.record.halfOpenCalls = 0;
      console.info(`[CircuitBreaker] '${this.name}' recovered — CLOSED`);
    }
  }

  getState(): {
    name: string;
    state: CircuitState;
    failuresInWindow: number;
    threshold: number;
    concurrency: number;
    maxConcurrency: number;
  } {
    this.trimFailures();
    return {
      name: this.name,
      state: this.record.state,
      failuresInWindow: this.record.failures.length,
      threshold: this.config.failureThreshold,
      concurrency: this.record.concurrency,
      maxConcurrency: this.config.maxConcurrency,
    };
  }
}

/** Global registry of circuit breakers */
const BREAKERS = new Map<string, CircuitBreaker>();

export function getCircuitBreaker(
  name: string,
  config?: CircuitBreakerConfig
): CircuitBreaker {
  if (!BREAKERS.has(name)) {
    BREAKERS.set(name, new CircuitBreaker(name, config));
  }
  return BREAKERS.get(name)!;
}

/** Wrap a function with a circuit breaker */
export function withCircuitBreaker<T>(
  name: string,
  fn: () => Promise<T>,
  fallback?: () => T,
  config?: CircuitBreakerConfig
): Promise<T> {
  return getCircuitBreaker(name, config).call(fn, fallback);
}
