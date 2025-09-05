// Parsing allowed host suffixes from environment variables
export function parseCommaList(value) {
  if (!value) return [];
  return value.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
}

// Returns true if hostname matches any suffix or if suffixes is empty
export function hostIsAllowed(hostname, suffixes) {
  if (suffixes.length === 0) return true;
  return suffixes.some(suffix => hostname.endsWith(suffix));
}

// Extracts everything before the allowed host suffix as subdomain
export function extractSubdomain(hostname) {
  const suffixes = parseCommaList(
    typeof process !== "undefined" && process.env && process.env.ALLOWED_HOST_SUFFIXES
      ? process.env.ALLOWED_HOST_SUFFIXES
      : (globalThis.ALLOWED_HOST_SUFFIXES || "")
  );
  for (const suffix of suffixes) {
    if (hostname.endsWith(suffix)) {
      const sub = hostname.slice(0, hostname.length - suffix.length);
      return sub.endsWith(".") ? sub.slice(0, -1) : sub;
    }
  }
  return "";
}
