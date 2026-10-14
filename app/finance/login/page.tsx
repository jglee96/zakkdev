import { FinanceLogin } from "@/features/finance-auth/ui/FinanceLogin";

export const dynamic = "force-dynamic";
export const metadata = { title: "금융 리서치 로그인 | zakklee.dev", robots: { index: false, follow: false } };

export default function FinanceLoginPage() {
  return <FinanceLogin />;
}
