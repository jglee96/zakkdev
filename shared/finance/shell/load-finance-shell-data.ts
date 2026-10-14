import "server-only";
import {
  getRecentMessages,
  getRepositoryConfig,
  listBots,
} from "../agent/repositories";
import { getFinanceTableRepoConfig } from "../api/table-repo-config";
import { MAIN_BOT_ID } from "../constants";
import { listRoutinesByOwner } from "../routine";
import { listRunsByOwner } from "../worker";
import {
  toFinanceBot,
  toFinanceMessage,
  toFinanceRoutine,
  toFinanceRun,
} from "./serializers";
import type { FinanceShellSnapshot } from "./types";

export async function loadFinanceShellData(
  ownerId: string,
  activeBotId = MAIN_BOT_ID,
): Promise<FinanceShellSnapshot> {
  const repoConfig = getRepositoryConfig();
  const tableRepo = getFinanceTableRepoConfig();

  const botsPromise = listBots(repoConfig, ownerId, "active");

  const [bots, routines, runs, activeBotMessages] = await Promise.all([
    botsPromise,
    listRoutinesByOwner(tableRepo, ownerId, "all"),
    listRunsByOwner(tableRepo, ownerId, undefined, 50),
    botsPromise.then(async (listedBots) => {
      if (activeBotId === MAIN_BOT_ID) {
        const main = listedBots.find((b) => b.template === "main");
        if (!main) {
          return [];
        }
        const stored = await getRecentMessages(repoConfig, main.id, 50);
        return stored.map((msg) => toFinanceMessage(msg, MAIN_BOT_ID));
      }
      const match = listedBots.find((b) => b.id === activeBotId);
      if (!match) {
        return [];
      }
      const stored = await getRecentMessages(repoConfig, match.id, 50);
      return stored.map((msg) => toFinanceMessage(msg, activeBotId));
    }),
  ]);

  return {
    activeBotId,
    bots: bots.map(toFinanceBot),
    routines: routines.map(toFinanceRoutine),
    runs: runs.map(toFinanceRun),
    activeBotMessages,
  };
}
