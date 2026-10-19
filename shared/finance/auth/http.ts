import "server-only";
import type { AuthConfig } from "./config";

export function jsonResponse(body: unknown, status = 200, extraHeaders?: HeadersInit) {
  const headers = new Headers(extraHeaders);
  headers.set("Cache-Control", "no-store");
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), { status, headers });
}

export function hasTrustedOrigin(request: Request, config: AuthConfig) {
  return request.headers.get("origin") === config.origin;
}

export function readSessionCookie(request: Request, config: AuthConfig) {
  const cookie = request.headers.get("cookie") || "";
  const matches = cookie.split(";").map((part) => part.trim()).filter((part) => part.startsWith(`${config.cookieName}=`));
  // Reject ambiguous duplicate cookies rather than choosing one.
  return matches.length === 1 ? matches[0].slice(config.cookieName.length + 1) : undefined;
}

export async function readPassword(request: Request): Promise<string | null> {
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json" || !request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    const data = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.length; }
    const body: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(data));
    if (!body || typeof body !== "object" || !("password" in body) || typeof body.password !== "string" ||
      body.password.length < 1 || new TextEncoder().encode(body.password).length > 1024) return null;
    return body.password;
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}
