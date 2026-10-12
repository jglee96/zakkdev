import assert from "node:assert/strict";
import { before, test } from "node:test";
import {
  parsePublishedDate,
  isValidPublishedDate,
  formatFilingUrl,
  isCorrection,
  extractPriorReceiptNo,
} from "../../shared/finance/data/types";
import { validateNumericConsistency, buildComparisonReport } from "../../shared/finance/data/thesis-repository";
import { createMockOpenDartClient, type MockOpenDartClient } from "../../shared/finance/data/opendart-client";
import type { Filing, Thesis, Evidence, Financials } from "../../shared/finance/data/types";
import {
  FIXTURE_FILINGS,
  FIXTURE_FILING_DETAILS,
  FIXTURE_FINANCIALS,
  FUTURE_FILING,
  DATE_ONLY_FILING,
  SAMSUNG_CORP_CODE,
  SAMSUNG_CORP_NAME,
} from "./fixtures/opendart-filings";

test("parsePublishedDate: 8자리 날짜 문자열을 YYYY-MM-DD로 변환", () => {
  const result = parsePublishedDate("20261001");
  assert.equal(result.publishedDate, "2026-10-01");
  assert.equal(result.timePrecision, "date");
});

test("parsePublishedDate: 이미 포맷된 날짜는 그대로 반환", () => {
  const result = parsePublishedDate("2026-10-01");
  assert.equal(result.publishedDate, "2026-10-01");
  assert.equal(result.timePrecision, "date");
});

test("parsePublishedDate: 하이픈 포함 날짜도 처리", () => {
  const result = parsePublishedDate("2026-09-15");
  assert.equal(result.publishedDate, "2026-09-15");
  assert.equal(result.timePrecision, "date");
});

test("isValidPublishedDate: 기준일 이전 날짜는 유효", () => {
  const referenceDate = new Date("2026-10-15");
  assert.equal(isValidPublishedDate("2026-10-01", referenceDate), true);
});

test("isValidPublishedDate: 기준일과 같은 날짜는 유효", () => {
  const referenceDate = new Date("2026-10-01");
  assert.equal(isValidPublishedDate("2026-10-01", referenceDate), true);
});

test("isValidPublishedDate: 기준일 이후 날짜는 무효", () => {
  const referenceDate = new Date("2026-09-01");
  assert.equal(isValidPublishedDate("2026-10-01", referenceDate), false);
});

test("isValidPublishedDate: 잘못된 날짜 형식은 무효", () => {
  const referenceDate = new Date("2026-10-01");
  assert.equal(isValidPublishedDate("invalid-date", referenceDate), false);
});

test("formatFilingUrl: DART 공시 URL 생성", () => {
  const url = formatFilingUrl("20261001000001");
  assert.equal(url, "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20261001000001");
});

test("isCorrection: 정정 공시 감지", () => {
  assert.equal(isCorrection("[정정]주요사항보고서"), true);
  assert.equal(isCorrection("기재정정 분기보고서"), true);
  assert.equal(isCorrection("첨부정정 반기보고서"), true);
});

test("isCorrection: 일반 공시는 false", () => {
  assert.equal(isCorrection("반기보고서"), false);
  assert.equal(isCorrection("주요사항보고서(자기주식취득결정)"), false);
});

test("extractPriorReceiptNo: 정정 공시에서 원본 접수번호 추출", () => {
  assert.equal(extractPriorReceiptNo("(정정 20260915000002)", "20260915000003"), "20260915000002");
  assert.equal(extractPriorReceiptNo("[정정 20260915000002]", "20260915000003"), "20260915000002");
});

test("extractPriorReceiptNo: 원본 번호 없으면 undefined", () => {
  assert.equal(extractPriorReceiptNo("[정정]주요사항보고서", "20260915000003"), undefined);
});

test("validateNumericConsistency: 숫자 값 정상 검증", () => {
  const result = validateNumericConsistency(12345, "원");
  assert.equal(result.valid, true);
  assert.equal(result.normalized, 12345);
});

test("validateNumericConsistency: 문자열 숫자 변환", () => {
  const result = validateNumericConsistency("1,234,567원", "원");
  assert.equal(result.valid, true);
  assert.equal(result.normalized, 1234567);
});

test("validateNumericConsistency: undefined는 유효", () => {
  const result = validateNumericConsistency(undefined, "원");
  assert.equal(result.valid, true);
  assert.equal(result.normalized, undefined);
});

test("validateNumericConsistency: 숫자 아닌 문자열은 무효", () => {
  const result = validateNumericConsistency("abc", "원");
  assert.equal(result.valid, false);
  assert.ok(result.error?.includes("숫자로 변환할 수 없습니다"));
});

test("validateNumericConsistency: Infinity는 무효", () => {
  const result = validateNumericConsistency(Infinity, "원");
  assert.equal(result.valid, false);
  assert.ok(result.error?.includes("유효하지 않은 숫자"));
});

test("buildComparisonReport: 기존 증거와 신규 공시 비교", () => {
  const mockThesis: Thesis = {
    id: "thesis-1",
    ownerId: "owner-1",
    botId: "bot-1",
    subject: SAMSUNG_CORP_NAME,
    corpCode: SAMSUNG_CORP_CODE,
    thesis: "삼성전자 반도체 사업 확대로 영업이익 증가 예상",
    status: "active",
    evidence: [
      {
        id: "ev-1",
        sourceType: "dart_filing",
        sourceId: "20260801000004",
        sourceUrl: "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260801000004",
        publishedDate: "2026-08-01",
        timePrecision: "date",
        firstSeenAt: 1690848000000,
        summary: "분기보고서 영업이익 증가 확인",
        supportType: "supports",
        addedAt: 1690848000000,
      },
    ],
    version: 1,
    createdAt: 1690848000000,
    updatedAt: 1690848000000,
  };

  const referenceDate = new Date("2026-10-15");
  const newFilings = FIXTURE_FILINGS.filter((f) => f.receiptNo !== "20260801000004");
  const report = buildComparisonReport(mockThesis, newFilings, referenceDate);

  assert.equal(report.existingEvidence.length, 1);
  assert.equal(report.comparisons.length, newFilings.length);

  const newFiling = report.comparisons.find((c) => c.filing.receiptNo === "20261001000001");
  assert.equal(newFiling?.isNew, true);
  assert.equal(newFiling?.withinRetrospective, true);
});

test("buildComparisonReport: 기준일 이후 공시에 경고 추가", () => {
  const mockThesis: Thesis = {
    id: "thesis-1",
    ownerId: "owner-1",
    botId: "bot-1",
    subject: SAMSUNG_CORP_NAME,
    thesis: "테스트 가설",
    status: "active",
    evidence: [],
    version: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const referenceDate = new Date("2026-09-01");
  const report = buildComparisonReport(mockThesis, FIXTURE_FILINGS, referenceDate);

  const futureComparison = report.comparisons.find(
    (c) => new Date(c.filing.publishedDate) > referenceDate
  );
  assert.equal(futureComparison?.withinRetrospective, false);
  assert.ok(report.warnings.some((w) => w.includes("이후 자료")));
});

test("buildComparisonReport: 미래 공시는 retrospective 범위 밖", () => {
  const mockThesis: Thesis = {
    id: "thesis-1",
    ownerId: "owner-1",
    botId: "bot-1",
    subject: SAMSUNG_CORP_NAME,
    thesis: "테스트 가설",
    status: "active",
    evidence: [],
    version: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const referenceDate = new Date("2026-10-15");
  const filingsWithFuture = [...FIXTURE_FILINGS, FUTURE_FILING];
  const report = buildComparisonReport(mockThesis, filingsWithFuture, referenceDate);

  const futureComparison = report.comparisons.find(
    (c) => c.filing.receiptNo === FUTURE_FILING.receiptNo
  );
  assert.equal(futureComparison?.withinRetrospective, false);
  assert.ok(report.warnings.some((w) => w.includes("2027-10-01")));
});

let mockClient: MockOpenDartClient;
before(() => {
  mockClient = createMockOpenDartClient({
    filings: FIXTURE_FILINGS,
    filingDetails: FIXTURE_FILING_DETAILS,
    financials: FIXTURE_FINANCIALS,
  });
});

test("MockOpenDartClient.searchFilings: 전체 공시 검색", async () => {
  const results = await mockClient.searchFilings({});
  assert.equal(results.length, FIXTURE_FILINGS.length);
});

test("MockOpenDartClient.searchFilings: 기업코드로 필터링", async () => {
  const results = await mockClient.searchFilings({ corpCode: SAMSUNG_CORP_CODE });
  assert.ok(results.every((f) => f.corpCode === SAMSUNG_CORP_CODE));
});

test("MockOpenDartClient.searchFilings: 기업명으로 필터링", async () => {
  const results = await mockClient.searchFilings({ corpName: "삼성" });
  assert.ok(results.every((f) => f.corpName.includes("삼성")));
});

test("MockOpenDartClient.searchFilings: 날짜 범위 필터링", async () => {
  const results = await mockClient.searchFilings({
    startDate: "2026-09-01",
    endDate: "2026-09-30",
  });
  assert.ok(results.every((f) => {
    const date = f.publishedDate.replace(/-/g, "");
    return date >= "20260901" && date <= "20260930";
  }));
});

test("MockOpenDartClient.searchFilings: pageSize 제한", async () => {
  const results = await mockClient.searchFilings({ pageSize: 2 });
  assert.ok(results.length <= 2);
});

test("MockOpenDartClient.getFilingDetail: 공시 상세 조회", async () => {
  const detail = await mockClient.getFilingDetail("20261001000001");
  assert.ok(detail !== null);
  assert.equal(detail?.receiptNo, "20261001000001");
  assert.ok(detail?.content !== undefined);
});

test("MockOpenDartClient.getFilingDetail: 없는 공시는 null", async () => {
  const detail = await mockClient.getFilingDetail("nonexistent");
  assert.equal(detail, null);
});

test("MockOpenDartClient.getFilingDetail: 정정 공시 상세 조회", async () => {
  const detail = await mockClient.getFilingDetail("20260915000003");
  assert.ok(detail !== null);
  assert.equal(detail?.isCorrection, true);
  assert.equal(detail?.priorReceiptNo, "20260915000002");
});

test("MockOpenDartClient.getFinancials: 재무제표 조회", async () => {
  const financials = await mockClient.getFinancials({
    corpCode: SAMSUNG_CORP_CODE,
    year: "2026",
    reportCode: "11012",
  });
  assert.ok(financials !== null);
  assert.ok(financials?.items !== undefined);
  assert.ok(financials?.items.some((i) => i.accountName === "매출액"));
});

test("MockOpenDartClient.getFinancials: 없는 재무제표는 null", async () => {
  const financials = await mockClient.getFinancials({
    corpCode: "00000000",
    year: "2025",
    reportCode: "11011",
  });
  assert.equal(financials, null);
});

test("Fixture: 정정 공시가 원본을 참조", () => {
  const correction = FIXTURE_FILINGS.find((f) => f.isCorrection);
  assert.ok(correction !== undefined);
  assert.ok(correction?.priorReceiptNo !== undefined);

  const original = FIXTURE_FILINGS.find(
    (f) => f.receiptNo === correction?.priorReceiptNo
  );
  assert.ok(original !== undefined);
  assert.equal(original?.isCorrection, false);
});

test("Fixture: 날짜 정밀도가 올바름", () => {
  assert.equal(DATE_ONLY_FILING.timePrecision, "date");
  assert.equal(DATE_ONLY_FILING.publishedAt, undefined);
});

test("Fixture: 미래 공시 날짜가 실제 미래", () => {
  const futureDate = new Date(FUTURE_FILING.publishedDate);
  const today = new Date("2026-10-12");
  assert.ok(futureDate > today);
});

test("Fixture: 모든 공시에 URL 있음", () => {
  for (const filing of FIXTURE_FILINGS) {
    assert.ok(filing.url.includes("dart.fss.or.kr"));
    assert.ok(filing.url.includes(filing.receiptNo));
  }
});

test("Fixture: 재무제표에 숫자 데이터 있음", () => {
  const key = `${SAMSUNG_CORP_CODE}_2026_11012`;
  const financials = FIXTURE_FINANCIALS[key];
  assert.ok(financials !== undefined);
  assert.ok(financials.items.length > 0);

  for (const item of financials.items) {
    assert.equal(typeof item.currentPeriod, "number");
    assert.ok(!Number.isNaN(item.currentPeriod));
  }
});

test("Regression: 숫자 변환 실패 시 명확한 에러", () => {
  const result = validateNumericConsistency("N/A", "원");
  assert.equal(result.valid, false);
  assert.ok(result.error !== undefined);
});

test("Regression: 빈 문자열도 숫자 변환 실패", () => {
  const result = validateNumericConsistency("", "원");
  assert.equal(result.valid, false);
});
