import "server-only";
import { randomUUID } from "node:crypto";
import {
  ConditionalCheckFailedException,
  DynamoDBClient,
} from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type {
  Thesis,
  ThesisStatus,
  Evidence,
  CreateThesisInput,
  UpdateThesisInput,
  Source,
  Filing,
} from "./types";

export class ThesisRepositoryError extends Error {
  constructor(
    message: string,
    public readonly code: "not_found" | "version_conflict" | "validation" | "storage"
  ) {
    super(message);
  }
}

export type ThesisRepositoryConfig = {
  readonly tableName: string;
  readonly client: DynamoDBDocumentClient;
};

function getThesisPK(ownerId: string, botId: string) {
  return `OWNER#${ownerId}#BOT#${botId}#THESES`;
}

function getThesisSK(thesisId: string) {
  return `THESIS#${thesisId}`;
}

function getSourcePK(provider: string) {
  return `SOURCE#${provider}`;
}

function getSourceSK(sourceId: string) {
  return `SRC#${sourceId}`;
}

export async function createThesis(
  config: ThesisRepositoryConfig,
  ownerId: string,
  input: CreateThesisInput,
  now = Date.now()
): Promise<Thesis> {
  const thesisId = randomUUID();

  const evidence: Evidence[] = input.evidence.map((e) => ({
    id: randomUUID(),
    ...e,
    addedAt: now,
  }));

  const thesis: Thesis = {
    id: thesisId,
    ownerId,
    botId: input.botId,
    subject: input.subject,
    ticker: input.ticker,
    corpCode: input.corpCode,
    thesis: input.thesis,
    status: input.status || "active",
    evidence,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };

  await config.client.send(
    new PutCommand({
      TableName: config.tableName,
      Item: {
        pk: getThesisPK(ownerId, input.botId),
        sk: getThesisSK(thesisId),
        entityType: "Thesis",
        gsi1pk: `SUBJECT#${input.subject.toLowerCase()}`,
        gsi1sk: getThesisSK(thesisId),
        ...thesis,
      },
      ConditionExpression: "attribute_not_exists(pk)",
    })
  );

  return thesis;
}

export async function getThesis(
  config: ThesisRepositoryConfig,
  ownerId: string,
  botId: string,
  thesisId: string
): Promise<Thesis | null> {
  const result = await config.client.send(
    new GetCommand({
      TableName: config.tableName,
      Key: {
        pk: getThesisPK(ownerId, botId),
        sk: getThesisSK(thesisId),
      },
    })
  );

  if (!result.Item || result.Item.entityType !== "Thesis") {
    return null;
  }

  return itemToThesis(result.Item);
}

export async function listThesesByBot(
  config: ThesisRepositoryConfig,
  ownerId: string,
  botId: string,
  status?: ThesisStatus | "all"
): Promise<Thesis[]> {
  const result = await config.client.send(
    new QueryCommand({
      TableName: config.tableName,
      KeyConditionExpression: "pk = :pk",
      FilterExpression: status && status !== "all" ? "#status = :status" : undefined,
      ExpressionAttributeNames: status && status !== "all" ? { "#status": "status" } : undefined,
      ExpressionAttributeValues: {
        ":pk": getThesisPK(ownerId, botId),
        ...(status && status !== "all" ? { ":status": status } : {}),
      },
    })
  );

  return (result.Items || [])
    .filter((item) => item.entityType === "Thesis")
    .map(itemToThesis);
}

export async function findThesesBySubject(
  config: ThesisRepositoryConfig,
  ownerId: string,
  botId: string,
  subject: string,
  status?: ThesisStatus | "all"
): Promise<Thesis[]> {
  const allTheses = await listThesesByBot(config, ownerId, botId, status);
  const normalizedSubject = subject.toLowerCase();

  return allTheses.filter((t) => {
    const normalizedThesisSubject = t.subject.toLowerCase();
    return (
      normalizedThesisSubject.includes(normalizedSubject) ||
      normalizedSubject.includes(normalizedThesisSubject) ||
      (t.ticker && t.ticker.toLowerCase() === normalizedSubject) ||
      (t.corpCode && t.corpCode === subject)
    );
  });
}

export async function updateThesis(
  config: ThesisRepositoryConfig,
  ownerId: string,
  botId: string,
  thesisId: string,
  input: UpdateThesisInput,
  now = Date.now()
): Promise<Thesis> {
  const existing = await getThesis(config, ownerId, botId, thesisId);
  if (!existing) {
    throw new ThesisRepositoryError("Thesis not found", "not_found");
  }

  const updates: string[] = ["#updatedAt = :updatedAt", "#version = #version + :one"];
  const names: Record<string, string> = {
    "#updatedAt": "updatedAt",
    "#version": "version",
  };
  const values: Record<string, unknown> = {
    ":updatedAt": now,
    ":one": 1,
    ":currentVersion": existing.version,
  };

  if (input.thesis !== undefined) {
    updates.push("#thesis = :thesis");
    names["#thesis"] = "thesis";
    values[":thesis"] = input.thesis;
  }

  if (input.status !== undefined) {
    updates.push("#status = :status");
    names["#status"] = "status";
    values[":status"] = input.status;
  }

  if (input.addEvidence && input.addEvidence.length > 0) {
    const newEvidence: Evidence[] = input.addEvidence.map((e) => ({
      id: randomUUID(),
      ...e,
      addedAt: now,
    }));
    const allEvidence = [...existing.evidence, ...newEvidence];
    updates.push("#evidence = :evidence");
    names["#evidence"] = "evidence";
    values[":evidence"] = allEvidence;
  }

  try {
    const result = await config.client.send(
      new UpdateCommand({
        TableName: config.tableName,
        Key: {
          pk: getThesisPK(ownerId, botId),
          sk: getThesisSK(thesisId),
        },
        UpdateExpression: `SET ${updates.join(", ")}`,
        ConditionExpression: "#version = :currentVersion",
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ReturnValues: "ALL_NEW",
      })
    );

    return itemToThesis(result.Attributes!);
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) {
      throw new ThesisRepositoryError("Version conflict - thesis was modified", "version_conflict");
    }
    throw error;
  }
}

function itemToThesis(item: Record<string, unknown>): Thesis {
  return {
    id: item.id as string,
    ownerId: item.ownerId as string,
    botId: item.botId as string,
    subject: item.subject as string,
    ticker: item.ticker as string | undefined,
    corpCode: item.corpCode as string | undefined,
    thesis: item.thesis as string,
    status: item.status as ThesisStatus,
    evidence: (item.evidence as Evidence[]) || [],
    version: item.version as number,
    createdAt: item.createdAt as number,
    updatedAt: item.updatedAt as number,
  };
}

export async function saveSource(
  config: ThesisRepositoryConfig,
  filing: Filing,
  now = Date.now()
): Promise<Source> {
  const source: Source = {
    id: randomUUID(),
    provider: "dart",
    sourceId: filing.receiptNo,
    corpCode: filing.corpCode,
    publishedDate: filing.publishedDate,
    publishedAt: filing.publishedAt,
    timePrecision: filing.timePrecision,
    firstSeenAt: filing.firstSeenAt,
    fetchedAt: now,
    url: filing.url,
    revision: filing.isCorrection ? 1 : undefined,
    priorSourceId: filing.priorReceiptNo,
  };

  await config.client.send(
    new PutCommand({
      TableName: config.tableName,
      Item: {
        pk: getSourcePK("dart"),
        sk: getSourceSK(filing.receiptNo),
        entityType: "Source",
        ...source,
      },
    })
  );

  return source;
}

export async function getSource(
  config: ThesisRepositoryConfig,
  provider: string,
  sourceId: string
): Promise<Source | null> {
  const result = await config.client.send(
    new GetCommand({
      TableName: config.tableName,
      Key: {
        pk: getSourcePK(provider),
        sk: getSourceSK(sourceId),
      },
    })
  );

  if (!result.Item || result.Item.entityType !== "Source") {
    return null;
  }

  return result.Item as unknown as Source;
}

export async function hasSource(
  config: ThesisRepositoryConfig,
  provider: string,
  sourceId: string
): Promise<boolean> {
  const source = await getSource(config, provider, sourceId);
  return source !== null;
}

export function buildComparisonReport(
  thesis: Thesis,
  newFilings: Filing[],
  referenceDate: Date
): {
  thesis: Thesis;
  comparisons: Array<{
    filing: Filing;
    relevance: "supports" | "contradicts" | "neutral" | "unknown";
    isNew: boolean;
    withinRetrospective: boolean;
  }>;
  existingEvidence: Evidence[];
  warnings: string[];
} {
  const warnings: string[] = [];
  const existingSourceIds = new Set(thesis.evidence.map((e) => e.sourceId));

  const comparisons = newFilings.map((filing) => {
    const filingDate = new Date(filing.publishedDate);
    const withinRetrospective = filingDate <= referenceDate;
    const isNew = !existingSourceIds.has(filing.receiptNo);

    if (!withinRetrospective) {
      warnings.push(
        `공시 ${filing.receiptNo}(${filing.publishedDate})는 기준일(${referenceDate.toISOString().slice(0, 10)}) 이후 자료입니다.`
      );
    }

    if (filing.timePrecision === "date" && filing.publishedAt) {
      warnings.push(
        `공시 ${filing.receiptNo}는 날짜 정밀도만 확인되었으나 시각(${filing.publishedAt})이 포함되어 있습니다.`
      );
    }

    return {
      filing,
      relevance: "unknown" as const,
      isNew,
      withinRetrospective,
    };
  });

  return {
    thesis,
    comparisons,
    existingEvidence: [...thesis.evidence],
    warnings,
  };
}

export function validateNumericConsistency(
  value: number | string | undefined,
  expectedUnit: string
): { valid: boolean; normalized?: number; error?: string } {
  if (value === undefined) {
    return { valid: true };
  }

  let numeric: number;
  if (typeof value === "string") {
    const cleaned = value.replace(/[,\s원$%]/g, "");
    if (cleaned === "") {
      return { valid: false, error: `빈 문자열은 유효한 숫자가 아닙니다.` };
    }
    numeric = Number(cleaned);
  } else {
    numeric = value;
  }

  if (isNaN(numeric)) {
    return { valid: false, error: `값을 숫자로 변환할 수 없습니다: ${value}` };
  }

  if (!isFinite(numeric)) {
    return { valid: false, error: `유효하지 않은 숫자입니다: ${value}` };
  }

  return { valid: true, normalized: numeric };
}
