// Extracts the client ID from the Cloudflare-specific header
// Unknown or invalid IPs are labeled as "unknown" for stricter rate limiting
export function getClientIdFromCloudflare(request) {
  const ip = request.headers.get("CF-Connecting-IP");
  if (!ip || ip.length > 64) return "unknown";
  return ip;
}

// Helper to create a response with body, status and headers
export function respond(body, status = 200, headers = {}) {
  return new Response(body, { status, headers });
}

// Helper to merge headers into a response
export function setHeaders(response, headers) {
  const newHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(headers)) {
    newHeaders.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}
