import { securityHeaders, authChallengeHeaders } from "./security-headers.js";
import { parseCommaList, parseSimpleCommaList, hostIsAllowed, extractSubdomain } from "./host.js";
import { getClientIdFromCloudflare, respond, setHeaders } from "./utils.js";
import { isRateLimited, registerFailedAttempt, clearFailures, rateLimitRetryHeaders, MAX_AUTH_HEADER_LENGTH } from "./ratelimit.js";
import { checkBasicAuth, isNonEmpty } from "./auth.js";

// Configuration cache to reduce per-request parsing overhead
let configCache = null;
let lastConfigHash = null;

// Generate a simple hash of the configuration values for cache invalidation
function getConfigHash(env) {
  const configString = `${env.ALLOWED_HOST_SUFFIXES || ''}|${env.PROTECTED_SUBDOMAINS || ''}`;
  let hash = 0;
  for (let i = 0; i < configString.length; i++) {
    const char = configString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash;
}

// Parse and cache configuration with hot-reload detection
function getCachedConfig(env) {
  const currentHash = getConfigHash(env);

  // Check if we need to invalidate cache (configuration changed)
  if (configCache === null || lastConfigHash !== currentHash) {
    configCache = {
      allowedHostSuffixes: parseCommaList(env.ALLOWED_HOST_SUFFIXES),
      protectedSubdomains: new Set(parseSimpleCommaList(env.PROTECTED_SUBDOMAINS))
    };
    lastConfigHash = currentHash;
  }

  return configCache;
}

// Safe re-read hook for development hot-reload
export function invalidateConfigCache() {
  configCache = null;
  lastConfigHash = null;
}

// Helper to get redirect target from env by subdomain
function getRedirectTarget(subdomain, env) {
  // Convention: LINK_<SUBDOMAIN> (uppercase)
  // For multi-level subdomains, dots are replaced with underscores
  // Example: foo.bar -> LINK_FOO_BAR
  const key = `LINK_${subdomain.toUpperCase().replace(/\./g, '_')}`;
  return env[key];
}

// Helper to get credentials from env by subdomain
function getCredentials(subdomain, env) {
  // Multi-user convention: USERS_<SUBDOMAIN> (uppercase)
  // Single-user convention: USER_<SUBDOMAIN>, PASS_<SUBDOMAIN> (uppercase)
  // For multi-level subdomains, dots are replaced with underscores
  // Example: foo.bar -> USERS_FOO_BAR OR USER_FOO_BAR, PASS_FOO_BAR
  const normalizedSubdomain = subdomain.toUpperCase().replace(/\./g, '_');
  const usersKey = `USERS_${normalizedSubdomain}`;
  const userKey = `USER_${normalizedSubdomain}`;
  const passKey = `PASS_${normalizedSubdomain}`;

  // Try JSON array first
  if (env[usersKey]) {
    try {
      const arr = JSON.parse(env[usersKey]);
      if (Array.isArray(arr) && arr.every(obj => obj && typeof obj.user === "string" && typeof obj.pass === "string")) {
        return arr;
      }
    } catch {
    }
  }

  // Fallback to single user/pass or global fallback
  return {
    user: env[userKey] || env.FALLBACK_USER,
    pass: env[passKey] || env.FALLBACK_PASS,
  };
}

// Enforce HTTPS redirection
export function enforceHttps(url) {
  if (url.protocol === "http:") {
    url.protocol = "https:";
    return Response.redirect(url.toString(), 301);
  }
  return null;
}

// Validate HTTP method
export function validateMethod(method) {
  const upperMethod = method.toUpperCase();
  if (upperMethod !== "GET" && upperMethod !== "HEAD") {
    return respond("Method Not Allowed", 405, securityHeaders({ "Allow": "GET, HEAD" }));
  }
  return null;
}

// Resolve subdomain and validate host
export function resolveSubdomain(hostname, allowedHostSuffixes) {
  if (!hostIsAllowed(hostname, allowedHostSuffixes)) {
    return { error: respond("Not found", 404, securityHeaders()) };
  }

  const subdomain = extractSubdomain(hostname, allowedHostSuffixes);
  return { subdomain };
}

// Handle authorization for protected subdomains
export async function authorizeProtectedSubdomain(request, subdomain, env) {
  const expected = getCredentials(subdomain, env);

  let hasValid;
  if (Array.isArray(expected)) {
    hasValid = expected.length > 0 && expected.every(({ user, pass }) => isNonEmpty(user) && isNonEmpty(pass));
  } else {
    hasValid = isNonEmpty(expected.user) && isNonEmpty(expected.pass);
  }
  if (!hasValid) {
    return respond("Not authorized", 401, authChallengeHeaders());
  }

  const clientId = getClientIdFromCloudflare(request);

  if (isRateLimited(clientId, subdomain)) {
    return respond("Too many requests", 429, rateLimitRetryHeaders(clientId, subdomain));
  }

  const authHeader = request.headers.get("Authorization") || "";
  if (authHeader.length > MAX_AUTH_HEADER_LENGTH) {
    registerFailedAttempt(clientId, subdomain);
    return respond("Not authorized", 401, authChallengeHeaders());
  }

  const isValid = checkBasicAuth(authHeader, expected);
  if (!isValid) {
    registerFailedAttempt(clientId, subdomain);
    return respond("Not authorized", 401, authChallengeHeaders());
  }

  clearFailures(clientId, subdomain);
  return null; // Success - no error response
}

// Handle redirect logic
export function handleRedirect(targetUrl) {
  if (targetUrl) {
    return setHeaders(Response.redirect(targetUrl, 302), securityHeaders());
  }
  return respond("Not found", 404, securityHeaders());
}

export default {
  // Main entry for Cloudflare Worker
  async fetch(request, env) {
    const url = new URL(request.url);

    // Enforce HTTPS
    const httpsResponse = enforceHttps(url);
    if (httpsResponse) return httpsResponse;

    // Only allow GET and HEAD
    const methodResponse = validateMethod(request.method);
    if (methodResponse) return methodResponse;

    // Get cached configuration to reduce per-request parsing overhead
    const { allowedHostSuffixes, protectedSubdomains } = getCachedConfig(env);

    // Resolve subdomain and validate host
    const hostname = url.hostname.toLowerCase();
    const { subdomain, error: subdomainError } = resolveSubdomain(hostname, allowedHostSuffixes);
    if (subdomainError) return subdomainError;

    // Get redirect target from env
    const targetUrl = getRedirectTarget(subdomain, env);

    // Check if subdomain is protected
    const isProtected = protectedSubdomains.has(subdomain);

    // If subdomain is protected but has no target, pretend it does not exist
    if (isProtected && !targetUrl) {
      return respond("Not found", 404, securityHeaders());
    }

    // Auth and rate limit for protected subdomains
    if (isProtected) {
      const authResponse = await authorizeProtectedSubdomain(request, subdomain, env);
      if (authResponse) return authResponse;
    }

    // Handle redirect
    return handleRedirect(targetUrl);
  }
};