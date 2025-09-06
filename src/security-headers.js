// Secure HTTP headers
export function securityHeaders(extra = {}) {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Embedder-Policy": "require-corp",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
    "Cache-Control": "no-store",
    ...extra,
  };
}

// WWW-Authenticate header for Basic Auth
export function authChallengeHeaders() {
  return securityHeaders({
    "WWW-Authenticate": 'Basic realm="Secure Redirect", charset="UTF-8"',
  });
}

// Merge new headers with response
export function setHeaders(response, headers) {
  const merged = new Headers(response.headers);
  for (const [k, v] of Object.entries(headers)) merged.set(k, v);
  return new Response(response.body, { status: response.status, headers: merged });
}

// Creates a new response with the given body, status and headers
export function respond(body, status, headers) {
  return new Response(body, { status, headers });
}
