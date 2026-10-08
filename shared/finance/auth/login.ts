import "server-only";
import { verify } from "@node-rs/argon2";
import { getAuthConfig, type AuthConfig } from "./config";
import { hasTrustedOrigin, jsonResponse, readPassword } from "./http";
import { consumeLoginAttempt, createRateLimitClient, getClientIdentity } from "./rate-limit";
import { createSession, sessionCookie } from "./session";

export type LoginDependencies = {
  config: () => AuthConfig;
  consume: (request: Request, config: AuthConfig) => Promise<{ allowed: boolean; retryAfter: number }>;
};

let client: ReturnType<typeof createRateLimitClient> | undefined;
const defaultDependencies: LoginDependencies = {
  config: getAuthConfig,
  async consume(request, config) {
    const table = process.env.FINANCE_AUTH_TABLE;
    if (!table || !/^[A-Za-z0-9_.-]{3,255}$/.test(table)) throw new Error("Authentication storage is not configured");
    const identity = getClientIdentity(request, config);
    client ??= createRateLimitClient();
    return consumeLoginAttempt(client, table, identity);
  },
};

export async function handleLogin(request: Request, dependencies = defaultDependencies) {
  try {
    const config = dependencies.config();
    if (!hasTrustedOrigin(request, config)) return jsonResponse({ error: "허용되지 않은 요청입니다." }, 403);
    const password = await readPassword(request);
    if (password === null) return jsonResponse({ error: "비밀번호를 입력해주세요." }, 400);
    const attempt = await dependencies.consume(request, config);
    if (!attempt.allowed) return jsonResponse({ error: "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요." }, 429, { "Retry-After": String(attempt.retryAfter) });
    if (!await verify(config.passwordHash, password)) return jsonResponse({ error: "비밀번호가 올바르지 않습니다." }, 401);
    const token = await createSession(config);
    return jsonResponse({ ok: true }, 200, { "Set-Cookie": sessionCookie(config, token) });
  } catch {
    // Deliberately exclude error objects, request bodies and credentials from logs/responses.
    return jsonResponse({ error: "금융 서비스를 이용할 수 없습니다." }, 503);
  }
}
