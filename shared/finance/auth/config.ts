import "server-only";

export const SESSION_SECONDS = 8 * 60 * 60;
export const OWNER_ID = "finance-owner";

export class AuthConfigurationError extends Error {
  constructor() {
    super("Finance authentication is not configured");
  }
}

export type AuthConfig = {
  origin: string;
  secure: boolean;
  cookieName: string;
  passwordHash: string;
  signingKey: Uint8Array;
};

export function getAuthConfig(env: Partial<NodeJS.ProcessEnv> = process.env): AuthConfig {
  try {
    const url = new URL(env.FINANCE_APP_ORIGIN || "");
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (
      url.origin !== env.FINANCE_APP_ORIGIN ||
      url.username || url.password ||
      (url.protocol !== "https:" && !(env.NODE_ENV !== "production" && local && url.protocol === "http:"))
    ) throw new AuthConfigurationError();
    const encodedKey = env.FINANCE_SESSION_SECRET || "";
    if (!/^[A-Za-z0-9_-]{43,172}$/.test(encodedKey)) throw new AuthConfigurationError();
    const base64 = encodedKey.replace(/-/g, "+").replace(/_/g, "/");
    const signingKey = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    if (signingKey.length < 32) throw new AuthConfigurationError();
    const passwordHash = env.FINANCE_PASSWORD_HASH || "";
    const hash = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$[A-Za-z0-9+/]{16,86}\$[A-Za-z0-9+/]{32,86}$/.exec(passwordHash);
    if (!hash || +hash[1] < 19456 || +hash[1] > 65536 || +hash[2] < 2 || +hash[2] > 6 || +hash[3] < 1 || +hash[3] > 4) {
      throw new AuthConfigurationError();
    }
    const secure = url.protocol === "https:";
    return { origin: url.origin, secure, cookieName: secure ? "__Host-finance-session" : "finance-session-local", passwordHash, signingKey };
  } catch {
    throw new AuthConfigurationError();
  }
}
