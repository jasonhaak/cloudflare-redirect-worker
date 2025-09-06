// Validates and normalizes a single host suffix
export function validateAndNormalizeSuffix(suffix) {
  if (!suffix || typeof suffix !== 'string') {
    throw new Error('Host suffix must be a non-empty string');
  }

  let normalized = suffix.trim().toLowerCase();

  // Reject empty or whitespace-only suffixes
  if (!normalized) {
    throw new Error('Host suffix cannot be empty or whitespace-only');
  }

  // Handle IPv6 addresses
  if (normalized.includes(':')) {
    if (!normalized.startsWith('[') || !normalized.endsWith(']')) {
      throw new Error('IPv6 addresses must be wrapped in brackets');
    }
    // For IPv6, don't add a leading dot
    return normalized;
  }

  // Basic punycode handling
  try {
    // Split by dots, process each part for punycode if needed
    const parts = normalized.split('.');
    const normalizedParts = parts.map(part => {
      if (!part) return part; // empty part (like the leading dot)
      // Check if part contains non-ASCII characters that need punycode
      if (/[^\x00-\x7F]/.test(part)) {
        // Convert to punycode
        try {
          const url = new URL(`http://${part}.example`);
          const hostname = url.hostname;
          return hostname.split('.')[0]; // Get the punycode
        } catch {
          throw new Error(`Invalid international domain name: ${part}`);
        }
      }
      return part;
    });
    normalized = normalizedParts.join('.');
  } catch (error) {
    if (error.message.includes('Invalid international domain name')) {
      throw error;
    }
    throw new Error(`Punycode conversion failed: ${error.message}`);
  }

  if (normalized.includes('..') || normalized.includes('.-') || normalized.includes('-.')) {
    throw new Error('Host suffix contains malformed domain tokens');
  }

  if (!/^[a-z0-9.-]+$/.test(normalized)) {
    throw new Error('Host suffix contains invalid characters');
  }

  if (!normalized.startsWith('.')) {
    normalized = '.' + normalized;
  }

  if (normalized.startsWith('.-') || normalized.endsWith('-.') || normalized.endsWith('.')) {
    throw new Error('Host suffix has invalid format');
  }

  return normalized;
}

// Parsing allowed host suffixes from environment variables with validation
export function parseCommaList(value) {
  if (!value) return [];

  const suffixes = value.split(",").map(s => s.replace(/\s+/g, "")).filter(Boolean);
  const validatedSuffixes = [];

  for (const suffix of suffixes) {
    try {
      const normalized = validateAndNormalizeSuffix(suffix);
      validatedSuffixes.push(normalized);
    } catch (error) {
      // Log warning but continue processing other suffixes
      console.warn(`Invalid host suffix "${suffix}": ${error.message}`);
    }
  }

  return validatedSuffixes;
}

// Returns true if hostname matches any suffix or if suffixes is empty
export function hostIsAllowed(hostname, suffixes) {
  if (suffixes.length === 0) return true;
  return suffixes.some(suffix => hostname.endsWith(suffix));
}

// Extracts everything before the allowed host suffix as subdomain
export function extractSubdomain(hostname, allowedHostSuffixes) {
  const suffixes = Array.isArray(allowedHostSuffixes)
    ? allowedHostSuffixes
    : parseCommaList(allowedHostSuffixes);

  for (const suffix of suffixes) {
    if (hostname.endsWith(suffix)) {
      const sub = hostname.slice(0, hostname.length - suffix.length);
      return sub.endsWith(".") ? sub.slice(0, -1) : sub;
    }
  }
  return "";
}

// Simple comma-separated list parser (no validation/normalization)
export function parseSimpleCommaList(value) {
  if (!value) return [];
  return value.split(",").map(s => s.replace(/\s+/g, "")).filter(Boolean);
}
