import type { SQSEvent, SQSHandler } from "aws-lambda";
import { getBot } from "../../../shared/finance/agent/repositories";
import { createAgentRuntimeConfig, runAgentForWorker } from "../../../shared/finance/agent/runtime";
import { getFinanceTableRepoConfig } from "../../../shared/finance/api/table-repo-config";
import { handleSQSEvent } from "../../../shared/finance/worker/handler";
import { loadRuntimeSecretsFromEnv } from "./load-runtime-secrets";

export const handler: SQSHandler = async (event: SQSEvent) => {
  await loadRuntimeSecretsFromEnv();
  const tableRepo = getFinanceTableRepoConfig();
  return handleSQSEvent(event, {
    runRepo: tableRepo,
    routineRepo: tableRepo,
    getBot: async (ownerId, botId) => getBot(tableRepo, ownerId, botId),
    runAgent: runAgentForWorker,
    createRuntimeConfig: () => createAgentRuntimeConfig(),
  });
};
