import { securityHeaders, authChallengeHeaders } from "./security-headers.js";
import { parseCommaList, hostIsAllowed, extractSubdomain } from "./host.js";
import { getClientIdFromCloudflare, respond, setHeaders } from "./utils.js";
import { isRateLimited, registerFailedAttempt, clearFailures, rateLimitRetryHeaders, MAX_AUTH_HEADER_LENGTH } from "./ratelimit.js";
import { checkBasicAuth, isNonEmpty } from "./auth.js";

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
  // Convention: USER_<SUBDOMAIN>, PASS_<SUBDOMAIN> (uppercase)
  // For multi-level subdomains, dots are replaced with underscores
  // Example: foo.bar -> USER_FOO_BAR, PASS_FOO_BAR
  const normalizedSubdomain = subdomain.toUpperCase().replace(/\./g, '_');
  const userKey = `USER_${normalizedSubdomain}`;
  const passKey = `PASS_${normalizedSubdomain}`;
  return {
    user: env[userKey] || env.FALLBACK_USER,
    pass: env[passKey] || env.FALLBACK_PASS,
  };
}

export default {
  // Main entry for Cloudflare Worker
  async fetch(request, env) {
    const url = new URL(request.url);

    // Enforce HTTPS
    if (url.protocol === "http:") {
      url.protocol = "https:";
      return Response.redirect(url.toString(), 301);
    }

    // Only allow GET and HEAD
    const method = request.method.toUpperCase();
    if (method !== "GET" && method !== "HEAD") {
      return respond("Method Not Allowed", 405, securityHeaders({ "Allow": "GET, HEAD" }));
    }

    // Restrict handling to known host suffixes (zone binding)
    // env.ALLOWED_HOST_SUFFIXES example: ".example.com,.example.org"
    const allowedHostSuffixes = parseCommaList(env.ALLOWED_HOST_SUFFIXES);
    const hostname = url.hostname.toLowerCase();
    if (!hostIsAllowed(hostname, allowedHostSuffixes)) {
      return respond("Not found", 404, securityHeaders());
    }

    // Get subdomain
    const subdomain = extractSubdomain(hostname, env.ALLOWED_HOST_SUFFIXES);

    // Get redirect target from env
    const targetUrl = getRedirectTarget(subdomain, env);

    // Get protected subdomains from env
    const protectedSubdomains = new Set(parseCommaList(env.PROTECTED_SUBDOMAINS));
    const isProtected = protectedSubdomains.has(subdomain);

    // If subdomain is protected but has no target, pretend it does not exist
    if (isProtected && !targetUrl) {
      return respond("Not found", 404, securityHeaders());
    }

    // Auth and rate limit for protected subdomains
    if (isProtected) {
      const { user: expectedUser, pass: expectedPass } = getCredentials(subdomain, env);

      if (!isNonEmpty(expectedUser) || !isNonEmpty(expectedPass)) {
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

      const isValid = checkBasicAuth(authHeader, expectedUser, expectedPass);
      if (!isValid) {
        registerFailedAttempt(clientId, subdomain);
        return respond("Not authorized", 401, authChallengeHeaders());
      }
      clearFailures(clientId, subdomain);
    }

    // Redirect if target is configured
    if (targetUrl) {
      return setHeaders(Response.redirect(targetUrl, 302), securityHeaders());
    }

    // Default: Unknown subdomain -> 404
    return respond("Not found", 404, securityHeaders());
  }
};