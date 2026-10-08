import { handleLogin } from "@/shared/finance/auth/login";

export const runtime = "nodejs";
export const maxDuration = 15;

export async function POST(request: Request) {
  return handleLogin(request);
}
