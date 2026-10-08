import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { FinanceHome } from "@/features/finance-auth/ui/FinanceHome";
import { getAuthConfig } from "@/shared/finance/auth/config";
import { verifySession } from "@/shared/finance/auth/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "금융 리서치 | zakklee.dev", robots: { index: false, follow: false } };

export default async function FinancePage() {
  let session = null;
  try {
    const config = getAuthConfig();
    session = await verifySession((await cookies()).get(config.cookieName)?.value, config);
  } catch { /* Missing configuration closes the private page. */ }
  if (!session) redirect("/finance/login");
  return <FinanceHome />;
}
