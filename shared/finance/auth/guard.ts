import "server-only";
import { getAuthConfig } from "./config";
import { hasTrustedOrigin, jsonResponse, readSessionCookie } from "./http";
import { verifySession } from "./session";

/** Every finance handler must call this before reading private data or invoking a tool. */
export async function requireFinanceSession(request: Request) {
  try {
    const config = getAuthConfig();
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method) && !hasTrustedOrigin(request, config)) {
      return { response: jsonResponse({ error: "허용되지 않은 요청입니다." }, 403) };
    }
    const session = await verifySession(readSessionCookie(request, config), config);
    if (!session) return { response: jsonResponse({ error: "로그인이 필요합니다." }, 401) };
    return { session, config };
  } catch {
    return { response: jsonResponse({ error: "금융 서비스를 이용할 수 없습니다." }, 503) };
  }
}
