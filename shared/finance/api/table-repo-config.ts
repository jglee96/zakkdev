import "server-only";
import { getRepositoryConfig } from "../agent/repositories";
import type { RunRepositoryConfig } from "../worker/run-repository";
import type { RoutineRepositoryConfig } from "../routine/repository";

/** Single-table Dynamo config for routines, runs, and bots (shared client). */
export function getFinanceTableRepoConfig(): RunRepositoryConfig & RoutineRepositoryConfig {
  const config = getRepositoryConfig();
  return {
    tableName: config.tableName,
    client: config.client,
  };
}
