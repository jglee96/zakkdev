import { NextRequest, NextResponse } from "next/server";
import { getAuthConfig } from "@/shared/finance/auth/config";
import { hasTrustedOrigin, jsonResponse, readSessionCookie } from "@/shared/finance/auth/http";
import { verifySession } from "@/shared/finance/auth/session";

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isApi = path.startsWith("/api/finance/") || path === "/api/finance";
  if (path === "/finance/login" || path === "/api/finance/auth/login") {
    const response = NextResponse.next();
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
  try {
    const authConfig = getAuthConfig();
    if (isApi && !["GET", "HEAD", "OPTIONS"].includes(request.method) && !hasTrustedOrigin(request, authConfig)) {
      return jsonResponse({ error: "허용되지 않은 요청입니다." }, 403);
    }
    const session = await verifySession(readSessionCookie(request, authConfig), authConfig);
    if (!session) {
      if (isApi) return jsonResponse({ error: "로그인이 필요합니다." }, 401);
      const response = NextResponse.redirect(new URL("/finance/login", request.url));
      response.headers.set("Cache-Control", "no-store");
      return response;
    }
    const response = NextResponse.next();
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    if (isApi) return jsonResponse({ error: "금융 서비스를 이용할 수 없습니다." }, 503);
    const response = NextResponse.redirect(new URL("/finance/login", request.url));
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}

export const config = { matcher: ["/finance/:path*", "/api/finance/:path*"] };
