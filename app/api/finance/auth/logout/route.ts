import { requireFinanceSession } from "@/shared/finance/auth/guard";
import { jsonResponse } from "@/shared/finance/auth/http";
import { sessionCookie } from "@/shared/finance/auth/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireFinanceSession(request);
  if (auth.response) return auth.response;
  return jsonResponse({ ok: true }, 200, { "Set-Cookie": sessionCookie(auth.config, "", 0) });
}
