const AUTH_COOKIE = "trip_planner_auth";
const AUTH_TTL_SECONDS = 60 * 60 * 24 * 30;

function getAuthSecret() {
  return process.env.AUTH_SECRET || "dev-trip-auth-secret-change-me";
}

export function getAuthCookieName() {
  return AUTH_COOKIE;
}

export function getAuthPassword() {
  return process.env.APP_AUTH_PASSWORD || "";
}

async function signValue(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getAuthSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return result === 0;
}

export async function createAuthToken() {
  const expiresAt = String(Date.now() + AUTH_TTL_SECONDS * 1000);
  const signature = await signValue(expiresAt);
  return `${expiresAt}.${signature}`;
}

export async function verifyAuthToken(token: string | undefined) {
  if (!token) return false;

  const [expiresAt, providedSignature] = token.split(".");
  if (!expiresAt || !providedSignature) return false;
  if (Number(expiresAt) < Date.now()) return false;

  const expectedSignature = await signValue(expiresAt);
  return safeEqual(expectedSignature, providedSignature);
}

export function getAuthCookieMaxAge() {
  return AUTH_TTL_SECONDS;
}
