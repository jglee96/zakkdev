import "server-only";
import { MAIN_BOT_ID } from "../constants";
import type { Bot } from "./types";
import { getBot, listBots, type RepositoryConfig } from "./repositories";

/** Resolve UI bot id (e.g. main-bot) to a stored bot row for message/history reads. */
export async function resolveBotForOwner(
  config: RepositoryConfig,
  ownerId: string,
  botId: string,
): Promise<Bot | null> {
  let bot = await getBot(config, ownerId, botId);
  if (!bot && botId === MAIN_BOT_ID) {
    const bots = await listBots(config, ownerId, "active");
    bot = bots.find((b) => b.template === "main") ?? null;
  }
  return bot;
}
