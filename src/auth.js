import { base64Decode } from './base64.js';

export function isNonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

// Checks Basic Auth header against expected credentials
export function checkBasicAuth(authorizationHeader, expectedUser, expectedPass) {
  if (!authorizationHeader || !authorizationHeader.startsWith("Basic ")) return false;

  // Extract and decode credentials from header
  const b64 = authorizationHeader.slice(6).trim();
  let decoded;
  try { decoded = base64Decode(b64); } catch { return false; }

  // Credentials must be in "user:pass" format
  const idx = decoded.indexOf(":");
  if (idx === -1) return false;
  const providedUser = decoded.slice(0, idx);
  const providedPass = decoded.slice(idx + 1);
  return constantTimeEqual(providedUser, expectedUser) &&
         constantTimeEqual(providedPass, expectedPass);
}

// Constant time string comparison
// Processes both strings fully to avoid timing leaks from early returns
export function constantTimeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;

  // Always process to the maximum length to avoid timing leaks
  const maxLen = Math.max(a.length, b.length);
  let diff = a.length ^ b.length; // XOR lengths to detect mismatch

  // Always iterate through maxLen characters to maintain constant time
  for (let i = 0; i < maxLen; i++) {
    const charA = i < a.length ? a.charCodeAt(i) : 0;
    const charB = i < b.length ? b.charCodeAt(i) : 0;
    diff |= charA ^ charB;
  }

  return diff === 0;
}
