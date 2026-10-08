import "server-only";
import { createHmac, randomUUID } from "node:crypto";
import { isIP } from "node:net";
import { DynamoDBClient, TransactionCanceledException } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { AuthConfigurationError, type AuthConfig } from "./config";

const WINDOW_SECONDS = 15 * 60;

export function getClientIdentity(request: Request, config: AuthConfig, env: Partial<NodeJS.ProcessEnv> = process.env) {
  if (env.VERCEL === "1") {
    // Vercel overwrites this header at its edge. Do not trust a client-supplied X-Forwarded-For.
    const ip = request.headers.get("x-vercel-forwarded-for")?.trim();
    if (!ip || !isIP(ip)) throw new AuthConfigurationError();
    return createHmac("sha256", config.signingKey).update(ip).digest("hex");
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(new URL(config.origin).hostname);
  if (env.NODE_ENV !== "production" && local) return "local-development";
  throw new AuthConfigurationError();
}

export function createRateLimitClient(env: Partial<NodeJS.ProcessEnv> = process.env) {
  const region = env.AWS_REGION || env.AWS_DEFAULT_REGION;
  if (!region) throw new AuthConfigurationError();
  let endpoint: string | undefined;
  if (env.FINANCE_DYNAMODB_ENDPOINT) {
    const url = new URL(env.FINANCE_DYNAMODB_ENDPOINT);
    if (env.NODE_ENV === "production" || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || url.protocol !== "http:" || url.username || url.password) {
      throw new AuthConfigurationError();
    }
    endpoint = url.origin;
  }
  return DynamoDBDocumentClient.from(new DynamoDBClient({ region, endpoint, maxAttempts: 2, ...(endpoint ? { credentials: { accessKeyId: "local", secretAccessKey: "local" } } : {}) }), {
    marshallOptions: { removeUndefinedValues: true },
  });
}

export async function consumeLoginAttempt(
  client: DynamoDBDocumentClient,
  tableName: string,
  identity: string,
  now = new Date(),
) {
  const seconds = Math.floor(now.getTime() / 1000);
  const bucket = Math.floor(seconds / WINDOW_SECONDS);
  const resetAt = (bucket + 1) * WINDOW_SECONDS;
  try {
    await client.send(new TransactWriteCommand({
      ClientRequestToken: randomUUID(),
      TransactItems: [{ key: `ip#${identity}#${bucket}`, limit: 5 }, { key: `global#${bucket}`, limit: 30 }].map(({ key, limit }) => ({
        Update: {
          TableName: tableName,
          Key: { pk: key },
          UpdateExpression: "SET expiresAt = :ttl ADD attempts :one",
          ConditionExpression: "attribute_not_exists(attempts) OR attempts < :limit",
          ExpressionAttributeValues: { ":ttl": resetAt + 86400, ":one": 1, ":limit": limit },
        },
      })),
    }));
    return { allowed: true as const, retryAfter: 0 };
  } catch (error) {
    if (error instanceof TransactionCanceledException && error.CancellationReasons?.some((reason) => reason.Code === "ConditionalCheckFailed")) {
      return { allowed: false as const, retryAfter: resetAt - seconds };
    }
    // A transaction conflict or outage is not an allowed login.
    throw error;
  }
}
