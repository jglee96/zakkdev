import "server-only";
import { getRepositoryConfig } from "../agent/repositories";
import type { RunRepositoryConfig } from "../worker/run-repository";
import type { RoutineRepositoryConfig } from "../routine/repository";

/** Single-table Dynamo config for routines, runs, and bots (shared client). */
export function getFinanceTableRepoConfig(
  env: Partial<NodeJS.ProcessEnv> = process.env,
): RunRepositoryConfig & RoutineRepositoryConfig {
  const config = getRepositoryConfig(env);
  return {
    tableName: config.tableName,
    client: config.client,
  };
}
