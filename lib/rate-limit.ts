/**
 * Simple in-memory rate limiting for login attempts
 * Prevents brute force attacks by limiting attempts per IP/email
 */

interface RateLimitEntry {
  attempts: number;
  firstAttempt: number;
  blocked: boolean;
}

// In-memory store (use Redis in production for distributed systems)
const rateLimitStore = new Map<string, RateLimitEntry>();

const MAX_ATTEMPTS = 5;
const BLOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const WINDOW_MS = 15 * 60 * 1000; // 15 minute window

/**
 * Check if an IP/email is rate limited
 * Returns { limited: boolean, remainingAttempts: number, blocked: boolean }
 */
export function checkRateLimit(identifier: string): {
  limited: boolean;
  remainingAttempts: number;
  blocked: boolean;
  resetTime: number;
} {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  // Clean up expired entries
  if (entry && now - entry.firstAttempt > WINDOW_MS) {
    rateLimitStore.delete(identifier);
  }

  // Check if blocked
  if (entry?.blocked) {
    const timeSinceBlocked = now - entry.firstAttempt;
    if (timeSinceBlocked < BLOCK_DURATION_MS) {
      return {
        limited: true,
        remainingAttempts: 0,
        blocked: true,
        resetTime: entry.firstAttempt + BLOCK_DURATION_MS,
      };
    }
    // Block expired, reset
    rateLimitStore.delete(identifier);
  }

  const currentEntry = rateLimitStore.get(identifier);
  if (!currentEntry) {
    return {
      limited: false,
      remainingAttempts: MAX_ATTEMPTS,
      blocked: false,
      resetTime: now + WINDOW_MS,
    };
  }

  const remainingAttempts = Math.max(0, MAX_ATTEMPTS - currentEntry.attempts);

  return {
    limited: currentEntry.attempts >= MAX_ATTEMPTS,
    remainingAttempts,
    blocked: currentEntry.blocked,
    resetTime: currentEntry.firstAttempt + WINDOW_MS,
  };
}

/**
 * Record a failed login attempt
 * Returns the updated rate limit status
 */
export function recordFailedAttempt(identifier: string): {
  limited: boolean;
  remainingAttempts: number;
  blocked: boolean;
} {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  if (!entry || now - entry.firstAttempt > WINDOW_MS) {
    // New entry or expired
    rateLimitStore.set(identifier, {
      attempts: 1,
      firstAttempt: now,
      blocked: false,
    });
    return {
      limited: false,
      remainingAttempts: MAX_ATTEMPTS - 1,
      blocked: false,
    };
  }

  entry.attempts++;

  // Block if exceeded max attempts
  if (entry.attempts >= MAX_ATTEMPTS) {
    entry.blocked = true;
  }

  return {
    limited: entry.blocked,
    remainingAttempts: Math.max(0, MAX_ATTEMPTS - entry.attempts),
    blocked: entry.blocked,
  };
}

/**
 * Reset rate limit for an identifier (e.g., after successful login)
 */
export function resetRateLimit(identifier: string): void {
  rateLimitStore.delete(identifier);
}

/**
 * Get human-readable time until reset
 */
export function getTimeUntilReset(resetTime: number): string {
  const now = Date.now();
  const diff = Math.max(0, resetTime - now);
  const minutes = Math.ceil(diff / (60 * 1000));
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}
