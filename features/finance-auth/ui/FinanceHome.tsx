"use client";

import type { FinanceShellSnapshot } from "@/shared/finance/shell/types";
import { FinanceShell } from "./finance-shell";

/** @deprecated Use FinanceShell with server-loaded initialData from app/finance/page.tsx */
export function FinanceHome({ initialData }: { initialData: FinanceShellSnapshot }) {
  return <FinanceShell initialData={initialData} />;
}
