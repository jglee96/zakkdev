import "server-only";
import { SignJWT } from "jose/jwt/sign";
import { jwtVerify } from "jose/jwt/verify";
import { type AuthConfig, OWNER_ID, SESSION_SECONDS } from "./config";

const ISSUER = "zakkdev-finance";
const AUDIENCE = "zakkdev-finance-owner";

export async function createSession(config: AuthConfig, now = new Date()) {
  const issuedAt = Math.floor(now.getTime() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(ISSUER).setAudience(AUDIENCE).setSubject(OWNER_ID)
    .setIssuedAt(issuedAt).setExpirationTime(issuedAt + SESSION_SECONDS)
    .sign(config.signingKey);
}

export async function verifySession(token: string | undefined, config: AuthConfig, now = new Date()) {
  if (!token || token.length > 2048) return null;
  try {
    const { payload, protectedHeader } = await jwtVerify(token, config.signingKey, {
      algorithms: ["HS256"], issuer: ISSUER, audience: AUDIENCE, currentDate: now,
      requiredClaims: ["sub", "iat", "exp"],
    });
    const current = Math.floor(now.getTime() / 1000);
    if (protectedHeader.typ !== "JWT" || payload.sub !== OWNER_ID ||
      typeof payload.iat !== "number" || typeof payload.exp !== "number" ||
      !Number.isInteger(payload.iat) || !Number.isInteger(payload.exp) ||
      payload.iat > current || payload.exp <= payload.iat || payload.exp - payload.iat > SESSION_SECONDS) return null;
    return { ownerId: OWNER_ID, expiresAt: payload.exp };
  } catch {
    return null;
  }
}

export function sessionCookie(config: AuthConfig, token: string, maxAge = SESSION_SECONDS) {
  return `${config.cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${config.secure ? "; Secure" : ""}`;
}
