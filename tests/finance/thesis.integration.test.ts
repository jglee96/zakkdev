import assert from "node:assert/strict";
import { before, after, test, describe } from "node:test";
import { randomUUID } from "node:crypto";
import { CreateTableCommand, DeleteTableCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import {
  createThesis,
  getThesis,
  listThesesByBot,
  findThesesBySubject,
  updateThesis,
  saveSource,
  getSource,
  hasSource,
  buildComparisonReport,
  ThesisRepositoryError,
  type ThesisRepositoryConfig,
} from "../../shared/finance/data/thesis-repository";
import type { Thesis, Filing } from "../../shared/finance/data/types";
import {
  FIXTURE_FILINGS,
  SAMSUNG_CORP_CODE,
  SAMSUNG_CORP_NAME,
  FUTURE_FILING,
} from "./fixtures/opendart-filings";

const isIntegration = process.env.TEST_TYPE === "integration";

let rawClient: DynamoDBClient;
let client: DynamoDBDocumentClient;
let config: ThesisRepositoryConfig;
const tableName = `ThesisTest-${randomUUID()}`;
const testOwnerId = `test-owner-${Date.now()}`;
const testBotId = `test-bot-${Date.now()}`;
const createdThesisIds: string[] = [];
const createdSourceIds: string[] = [];

before(async () => {
  if (!isIntegration) return;
  
  rawClient = new DynamoDBClient({
    region: "ap-northeast-2",
    endpoint: process.env.FINANCE_DYNAMODB_ENDPOINT || "http://127.0.0.1:8000",
    credentials: { accessKeyId: "local", secretAccessKey: "local" },
  });

  await rawClient.send(
    new CreateTableCommand({
      TableName: tableName,
      KeySchema: [
        { AttributeName: "pk", KeyType: "HASH" },
        { AttributeName: "sk", KeyType: "RANGE" },
      ],
      AttributeDefinitions: [
        { AttributeName: "pk", AttributeType: "S" },
        { AttributeName: "sk", AttributeType: "S" },
      ],
      BillingMode: "PAY_PER_REQUEST",
    })
  );

  client = DynamoDBDocumentClient.from(rawClient, {
    marshallOptions: { removeUndefinedValues: true },
  });
  config = { tableName, client };
});

after(async () => {
  if (!isIntegration) return;

  await rawClient.send(new DeleteTableCommand({ TableName: tableName })).catch(() => undefined);
  rawClient.destroy();
});

test("createThesis: 새 가설 생성", { skip: !isIntegration }, async () => {
  const thesis = await createThesis(config, testOwnerId, {
    botId: testBotId,
    subject: SAMSUNG_CORP_NAME,
    corpCode: SAMSUNG_CORP_CODE,
    thesis: "삼성전자 반도체 사업 확대로 영업이익 증가 예상",
    evidence: [
      {
        sourceType: "dart_filing",
        sourceId: FIXTURE_FILINGS[0].receiptNo,
        sourceUrl: FIXTURE_FILINGS[0].url,
        publishedDate: FIXTURE_FILINGS[0].publishedDate,
        timePrecision: "date",
        firstSeenAt: Date.now(),
        summary: "반기보고서에서 반도체 매출 증가 확인",
        supportType: "supports",
      },
    ],
  });

  createdThesisIds.push(thesis.id);

  assert.ok(thesis.id);
  assert.equal(thesis.ownerId, testOwnerId);
  assert.equal(thesis.botId, testBotId);
  assert.equal(thesis.subject, SAMSUNG_CORP_NAME);
  assert.equal(thesis.status, "active");
  assert.equal(thesis.evidence.length, 1);
  assert.equal(thesis.version, 1);
});

test("createThesis: 증거 없이 가설 생성 가능", { skip: !isIntegration }, async () => {
  const thesis = await createThesis(config, testOwnerId, {
    botId: testBotId,
    subject: "SK하이닉스",
    thesis: "HBM 수요 증가로 이익 개선 예상",
    evidence: [],
    status: "active",
  });

  createdThesisIds.push(thesis.id);
  assert.equal(thesis.evidence.length, 0);
});

test("getThesis: 가설 조회", { skip: !isIntegration }, async () => {
  const created = await createThesis(config, testOwnerId, {
    botId: testBotId,
    subject: "테스트 기업",
    thesis: "테스트 가설",
    evidence: [],
  });
  createdThesisIds.push(created.id);

  const fetched = await getThesis(config, testOwnerId, testBotId, created.id);

  assert.ok(fetched !== null);
  assert.equal(fetched?.id, created.id);
  assert.equal(fetched?.thesis, "테스트 가설");
});

test("getThesis: 없는 가설은 null 반환", { skip: !isIntegration }, async () => {
  const fetched = await getThesis(config, testOwnerId, testBotId, "nonexistent-id");
  assert.equal(fetched, null);
});

test("getThesis: 다른 owner의 가설은 조회 불가", { skip: !isIntegration }, async () => {
  const created = await createThesis(config, testOwnerId, {
    botId: testBotId,
    subject: "격리 테스트",
    thesis: "소유자 격리 확인",
    evidence: [],
  });
  createdThesisIds.push(created.id);

  const fetched = await getThesis(config, "other-owner", testBotId, created.id);
  assert.equal(fetched, null);
});

test("listThesesByBot: 봇의 모든 가설 조회", { skip: !isIntegration }, async () => {
  const listBotId = `list-test-bot-${Date.now()}`;

  const t1 = await createThesis(config, testOwnerId, {
    botId: listBotId,
    subject: "기업1",
    thesis: "가설1",
    evidence: [],
    status: "active",
  });
  createdThesisIds.push(t1.id);

  const t2 = await createThesis(config, testOwnerId, {
    botId: listBotId,
    subject: "기업2",
    thesis: "가설2",
    evidence: [],
    status: "supported",
  });
  createdThesisIds.push(t2.id);

  const allTheses = await listThesesByBot(config, testOwnerId, listBotId);
  assert.ok(allTheses.length >= 2);

  const activeTheses = await listThesesByBot(config, testOwnerId, listBotId, "active");
  assert.ok(activeTheses.every((t) => t.status === "active"));
});

test("findThesesBySubject: 주제로 가설 검색", { skip: !isIntegration }, async () => {
  const findBotId = `find-test-bot-${Date.now()}`;

  const t = await createThesis(config, testOwnerId, {
    botId: findBotId,
    subject: "삼성전자",
    thesis: "반도체 성장",
    evidence: [],
  });
  createdThesisIds.push(t.id);

  const results = await findThesesBySubject(config, testOwnerId, findBotId, "삼성");
  assert.ok(results.length >= 1);
  assert.ok(results.some((r) => r.subject.includes("삼성")));
});

test("findThesesBySubject: ticker로 검색", { skip: !isIntegration }, async () => {
  const findBotId = `ticker-test-bot-${Date.now()}`;

  const t = await createThesis(config, testOwnerId, {
    botId: findBotId,
    subject: "삼성전자",
    ticker: "005930",
    thesis: "반도체 성장",
    evidence: [],
  });
  createdThesisIds.push(t.id);

  const results = await findThesesBySubject(config, testOwnerId, findBotId, "005930");
  assert.ok(results.length >= 1);
});

test("updateThesis: 가설 내용 업데이트", { skip: !isIntegration }, async () => {
  const created = await createThesis(config, testOwnerId, {
    botId: testBotId,
    subject: "업데이트 테스트",
    thesis: "원본 가설",
    evidence: [],
  });
  createdThesisIds.push(created.id);

  const updated = await updateThesis(config, testOwnerId, testBotId, created.id, {
    thesis: "수정된 가설",
    status: "supported",
  });

  assert.equal(updated.thesis, "수정된 가설");
  assert.equal(updated.status, "supported");
  assert.equal(updated.version, 2);
});

test("updateThesis: 증거 추가", { skip: !isIntegration }, async () => {
  const created = await createThesis(config, testOwnerId, {
    botId: testBotId,
    subject: "증거 추가 테스트",
    thesis: "테스트 가설",
    evidence: [
      {
        sourceType: "dart_filing",
        sourceId: "original-source",
        sourceUrl: "https://example.com/original",
        publishedDate: "2026-08-01",
        timePrecision: "date",
        firstSeenAt: Date.now(),
        summary: "원본 증거",
        supportType: "supports",
      },
    ],
  });
  createdThesisIds.push(created.id);

  const updated = await updateThesis(config, testOwnerId, testBotId, created.id, {
    addEvidence: [
      {
        sourceType: "dart_filing",
        sourceId: FIXTURE_FILINGS[0].receiptNo,
        sourceUrl: FIXTURE_FILINGS[0].url,
        publishedDate: FIXTURE_FILINGS[0].publishedDate,
        timePrecision: "date",
        firstSeenAt: Date.now(),
        summary: "추가된 증거",
        supportType: "supports",
      },
    ],
  });

  assert.equal(updated.evidence.length, 2);
  assert.equal(updated.evidence[1].summary, "추가된 증거");
});

test("updateThesis: 없는 가설 업데이트 시 에러", { skip: !isIntegration }, async () => {
  await assert.rejects(
    updateThesis(config, testOwnerId, testBotId, "nonexistent-id", {
      thesis: "업데이트",
    }),
    ThesisRepositoryError
  );
});

test("saveSource: 공시 소스 저장", { skip: !isIntegration }, async () => {
  const filing = FIXTURE_FILINGS[0];
  const source = await saveSource(config, filing);

  createdSourceIds.push(filing.receiptNo);

  assert.ok(source.id);
  assert.equal(source.provider, "dart");
  assert.equal(source.sourceId, filing.receiptNo);
  assert.equal(source.url, filing.url);
});

test("hasSource: 소스 존재 확인", { skip: !isIntegration }, async () => {
  const filing = FIXTURE_FILINGS[1];
  await saveSource(config, filing);
  createdSourceIds.push(filing.receiptNo);

  const exists = await hasSource(config, "dart", filing.receiptNo);
  assert.equal(exists, true);

  const notExists = await hasSource(config, "dart", "nonexistent");
  assert.equal(notExists, false);
});

test("getSource: 소스 조회", { skip: !isIntegration }, async () => {
  const filing = FIXTURE_FILINGS[2];
  await saveSource(config, filing);
  createdSourceIds.push(filing.receiptNo);

  const source = await getSource(config, "dart", filing.receiptNo);
  assert.ok(source !== null);
  assert.equal(source?.sourceId, filing.receiptNo);
});

test("saveSource: 정정 공시 소스는 priorSourceId 포함", { skip: !isIntegration }, async () => {
  const correctionFiling = FIXTURE_FILINGS.find((f) => f.isCorrection)!;
  await saveSource(config, correctionFiling);
  createdSourceIds.push(correctionFiling.receiptNo);

  const source = await getSource(config, "dart", correctionFiling.receiptNo);
  assert.equal(source?.revision, 1);
  assert.equal(source?.priorSourceId, correctionFiling.priorReceiptNo);
});

test("buildComparisonReport: 미래 공시는 retrospective 범위 밖으로 표시", { skip: !isIntegration }, async () => {
  const thesis = await createThesis(config, testOwnerId, {
    botId: testBotId,
    subject: SAMSUNG_CORP_NAME,
    thesis: "테스트 가설",
    evidence: [],
  });
  createdThesisIds.push(thesis.id);

  const referenceDate = new Date("2026-10-15");
  const filingsWithFuture = [...FIXTURE_FILINGS, FUTURE_FILING];

  const report = buildComparisonReport(thesis, filingsWithFuture, referenceDate);

  const futureComparison = report.comparisons.find(
    (c) => c.filing.receiptNo === FUTURE_FILING.receiptNo
  );
  assert.ok(futureComparison !== undefined);
  assert.equal(futureComparison?.withinRetrospective, false);
  assert.ok(report.warnings.some((w) => w.includes("이후 자료")));
});
