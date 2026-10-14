import "server-only";
import { getFinanceTableRepoConfig } from "../api/table-repo-config";
import {
  createSchedulerClientFromEnv,
  getScheduleTargetForMode,
  resolveFinanceSchedulerMode,
  shouldUseRoutineOrchestrator,
  type ResolvedFinanceSchedulerMode,
} from "../schedule/scheduler-runtime";
import type { RoutineOrchestratorConfig } from "./orchestrator";

export function getRoutineOrchestratorConfig(
  env: Partial<NodeJS.ProcessEnv> = process.env,
): RoutineOrchestratorConfig {
  const mode = resolveFinanceSchedulerMode(env);
  return {
    routineRepo: getFinanceTableRepoConfig(env),
    schedulerClient: createSchedulerClientFromEnv(env),
    scheduleTarget: getScheduleTargetForMode(mode, env),
  };
}

export function isSchedulerOrchestrationEnabled(
  env: Partial<NodeJS.ProcessEnv> = process.env,
): boolean {
  return shouldUseRoutineOrchestrator(resolveFinanceSchedulerMode(env));
}

export function getResolvedSchedulerMode(
  env: Partial<NodeJS.ProcessEnv> = process.env,
): ResolvedFinanceSchedulerMode {
  return resolveFinanceSchedulerMode(env);
}
