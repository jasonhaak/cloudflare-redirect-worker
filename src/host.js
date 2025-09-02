// Parsing allowed host suffixes from environment variables
function parseCommaList(value) {
  if (!value) return [];
  return value.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
}

// Returns true if hostname matches any suffix or if suffixes is empty
function hostIsAllowed(hostname, suffixes) {
  if (suffixes.length === 0) return true;
  return suffixes.some(suffix => hostname.endsWith(suffix));
}

// Extracts first label as subdomain or empty string
function extractSubdomain(hostname) {
  const labels = hostname.split(".");
  return labels.length > 2 ? labels[0].toLowerCase() : (labels.length >= 2 ? labels[0].toLowerCase() : "");
}