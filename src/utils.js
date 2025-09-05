// Extracts the client ID from the Cloudflare-specific header
// Unknown or invalid IPs are labeled as "unknown" for stricter rate limiting
function getClientIdFromCloudflare(request) {
  const ip = request.headers.get("CF-Connecting-IP");
  if (!ip || ip.length > 64) return "unknown";
  return ip;
}

module.exports = { getClientIdFromCloudflare };
