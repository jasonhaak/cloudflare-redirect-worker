const { securityHeaders } = require('./security-headers');

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_FAILED_ATTEMPTS = 10;
const MAX_FAILED_ATTEMPTS_UNKNOWN = 3; // Stricter for unknown clients

// Capacity & eviction to avoid unbounded memory growth
const MAX_RATE_LIMIT_KEYS = 10_000;

// Authorization header sanity limit to reduce header-based DoS attempts
const MAX_AUTH_HEADER_LENGTH = 4096;

// Internal bucket: Key -> { fails, resetAt }
const RATE_LIMIT_BUCKET = new Map();

function makeRateLimitKey(clientId, subdomain) {
  return `${clientId}::${subdomain}`;
}

function nowMs() { return Date.now(); }

function pruneIfExpired(key) {
  const entry = RATE_LIMIT_BUCKET.get(key);
  if (entry && nowMs() > entry.resetAt) RATE_LIMIT_BUCKET.delete(key);
}

// Remove oldest entry if bucket is full
function evictIfNeeded() {
  if (RATE_LIMIT_BUCKET.size < MAX_RATE_LIMIT_KEYS) return;
  const firstKey = RATE_LIMIT_BUCKET.keys().next().value;
  if (firstKey) RATE_LIMIT_BUCKET.delete(firstKey);
}

function limitFor(clientId) {
  return clientId === "unknown" ? MAX_FAILED_ATTEMPTS_UNKNOWN : MAX_FAILED_ATTEMPTS;
}

function isRateLimited(clientId, subdomain) {
  const key = makeRateLimitKey(clientId, subdomain);
  pruneIfExpired(key);
  const entry = RATE_LIMIT_BUCKET.get(key);
  return !!entry && entry.fails >= limitFor(clientId);
}

function registerFailedAttempt(clientId, subdomain) {
  const key = makeRateLimitKey(clientId, subdomain);
  pruneIfExpired(key);
  const currentTime = nowMs();
  let entry = RATE_LIMIT_BUCKET.get(key);
  if (!entry) {
    evictIfNeeded();
    entry = { fails: 0, resetAt: currentTime + RATE_LIMIT_WINDOW_MS };
    RATE_LIMIT_BUCKET.set(key, entry);
  }
  entry.fails += 1;
}

function clearFailures(clientId, subdomain) {
  RATE_LIMIT_BUCKET.delete(makeRateLimitKey(clientId, subdomain));
}

function remainingWindowSeconds(clientId, subdomain) {
  const entry = RATE_LIMIT_BUCKET.get(makeRateLimitKey(clientId, subdomain));
  if (!entry) return 0;
  return Math.ceil(Math.max(0, entry.resetAt - nowMs()) / 1000);
}

function rateLimitRetryHeaders(clientId, subdomain) {
  return securityHeaders({ "Retry-After": String(remainingWindowSeconds(clientId, subdomain)) });
}

module.exports = {
  RATE_LIMIT_WINDOW_MS,
  MAX_FAILED_ATTEMPTS,
  MAX_FAILED_ATTEMPTS_UNKNOWN,
  MAX_RATE_LIMIT_KEYS,
  MAX_AUTH_HEADER_LENGTH,
  RATE_LIMIT_BUCKET,
  makeRateLimitKey,
  nowMs,
  pruneIfExpired,
  evictIfNeeded,
  limitFor,
  isRateLimited,
  registerFailedAttempt,
  clearFailures,
  remainingWindowSeconds,
  rateLimitRetryHeaders
};
