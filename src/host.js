// Parsing allowed host suffixes from environment variables
export function parseCommaList(value) {
  if (!value) return [];
  // Remove all whitespace characters from each suffix
  return value.split(",").map(s => s.replace(/\s+/g, "").toLowerCase()).filter(Boolean);
}

// Returns true if hostname matches any suffix or if suffixes is empty
export function hostIsAllowed(hostname, suffixes) {
  if (suffixes.length === 0) return true;
  return suffixes.some(suffix => hostname.endsWith(suffix));
}

// Extracts everything before the allowed host suffix as subdomain
export function extractSubdomain(hostname, allowedHostSuffixes) {
  const suffixes = parseCommaList(allowedHostSuffixes);
  for (const suffix of suffixes) {
    if (hostname.endsWith(suffix)) {
      const sub = hostname.slice(0, hostname.length - suffix.length);
      return sub.endsWith(".") ? sub.slice(0, -1) : sub;
    }
  }
  return "";
}
