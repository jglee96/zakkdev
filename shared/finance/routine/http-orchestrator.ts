import "server-only";
import type { OrchestratorResult } from "./orchestrator";

export function orchestratorErrorStatus(code: string): number {
  switch (code) {
    case "NOT_FOUND":
      return 404;
    case "DELETED":
    case "VALIDATION":
      return 400;
    case "CONFLICT":
      return 409;
    case "LIMIT":
      return 429;
    default:
      return 502;
  }
}

export function orchestratorFailureMessage(result: Extract<OrchestratorResult<unknown>, { success: false }>) {
  return { error: result.error, code: result.code };
}
