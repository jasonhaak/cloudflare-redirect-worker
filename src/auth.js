export function isNonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

// Checks Basic Auth header against expected credentials
export function checkBasicAuth(authorizationHeader, expectedUser, expectedPass) {
  if (!authorizationHeader || !authorizationHeader.startsWith("Basic ")) return false;

  // Extract and decode credentials from header
  const b64 = authorizationHeader.slice(6).trim();
  let decoded;
  try { decoded = atob(b64); } catch { return false; }

  // Credentials must be in "user:pass" format
  const idx = decoded.indexOf(":");
  if (idx === -1) return false;
  const providedUser = decoded.slice(0, idx);
  const providedPass = decoded.slice(idx + 1);
  return constantTimeEqual(providedUser, expectedUser) &&
         constantTimeEqual(providedPass, expectedPass);
}

// Constant time string comparison
export function constantTimeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
