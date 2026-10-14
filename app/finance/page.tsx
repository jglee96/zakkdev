import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { FinanceShell } from "@/features/finance-auth/ui/finance-shell";
import { getAuthConfig } from "@/shared/finance/auth/config";
import { verifySession } from "@/shared/finance/auth/session";
import { loadFinanceShellData } from "@/shared/finance/shell/load-finance-shell-data";

export const dynamic = "force-dynamic";
export const metadata = { title: "금융 리서치 | zakklee.dev", robots: { index: false, follow: false } };

export default async function FinancePage() {
  let session = null;
  try {
    const config = getAuthConfig();
    session = await verifySession((await cookies()).get(config.cookieName)?.value, config);
  } catch {
    /* Missing configuration closes the private page. */
  }
  if (!session) redirect("/finance/login");

  const initialData = await loadFinanceShellData(session.ownerId);
  return <FinanceShell initialData={initialData} />;
}
