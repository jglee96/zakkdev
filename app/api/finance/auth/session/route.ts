import { requireFinanceSession } from "@/shared/finance/auth/guard";
import { jsonResponse } from "@/shared/finance/auth/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireFinanceSession(request);
  if (auth.response) return auth.response;
  return jsonResponse(auth.session);
}
