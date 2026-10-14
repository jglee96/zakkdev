import type { Filing, FilingDetail, Financials } from "../../../shared/finance/data";

export const SAMSUNG_CORP_CODE = "00126380";
export const SAMSUNG_CORP_NAME = "삼성전자";

export const FIXTURE_FILINGS: Filing[] = [
  {
    receiptNo: "20261001000001",
    corpCode: SAMSUNG_CORP_CODE,
    corpName: SAMSUNG_CORP_NAME,
    stockCode: "005930",
    reportName: "반기보고서",
    filingType: "정기공시",
    publishedDate: "2026-10-01",
    timePrecision: "date",
    firstSeenAt: 1696118400000,
    url: "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20261001000001",
    isCorrection: false,
  },
  {
    receiptNo: "20260915000002",
    corpCode: SAMSUNG_CORP_CODE,
    corpName: SAMSUNG_CORP_NAME,
    stockCode: "005930",
    reportName: "주요사항보고서(자기주식취득결정)",
    filingType: "주요사항보고",
    publishedDate: "2026-09-15",
    timePrecision: "date",
    firstSeenAt: 1694736000000,
    url: "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260915000002",
    isCorrection: false,
  },
  {
    receiptNo: "20260915000003",
    corpCode: SAMSUNG_CORP_CODE,
    corpName: SAMSUNG_CORP_NAME,
    stockCode: "005930",
    reportName: "[정정]주요사항보고서(자기주식취득결정)",
    filingType: "주요사항보고",
    publishedDate: "2026-09-16",
    timePrecision: "date",
    firstSeenAt: 1694822400000,
    url: "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260915000003",
    isCorrection: true,
    priorReceiptNo: "20260915000002",
  },
  {
    receiptNo: "20260801000004",
    corpCode: SAMSUNG_CORP_CODE,
    corpName: SAMSUNG_CORP_NAME,
    stockCode: "005930",
    reportName: "분기보고서 (2026.06)",
    filingType: "정기공시",
    publishedDate: "2026-08-01",
    timePrecision: "date",
    firstSeenAt: 1690848000000,
    url: "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260801000004",
    isCorrection: false,
  },
  {
    receiptNo: "20261215000005",
    corpCode: SAMSUNG_CORP_CODE,
    corpName: SAMSUNG_CORP_NAME,
    stockCode: "005930",
    reportName: "사업보고서 (2026.12)",
    filingType: "정기공시",
    publishedDate: "2026-12-15",
    timePrecision: "date",
    firstSeenAt: 1702598400000,
    url: "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20261215000005",
    isCorrection: false,
  },
];

export const FIXTURE_FILING_DETAILS: Record<string, FilingDetail> = {
  "20261001000001": {
    ...FIXTURE_FILINGS[0],
    content: "삼성전자 반기보고서 내용...",
    fetchedAt: 1696118400000,
  },
  "20260915000002": {
    ...FIXTURE_FILINGS[1],
    content: "자기주식 취득 결정 공시 내용...",
    fetchedAt: 1694736000000,
  },
  "20260915000003": {
    ...FIXTURE_FILINGS[2],
    content: "정정된 자기주식 취득 결정 공시 내용... (취득 규모 수정)",
    fetchedAt: 1694822400000,
  },
};

export const FIXTURE_FINANCIALS: Record<string, Financials> = {
  [`${SAMSUNG_CORP_CODE}_2026_11012`]: {
    corpCode: SAMSUNG_CORP_CODE,
    corpName: SAMSUNG_CORP_NAME,
    year: "2026",
    reportCode: "11012",
    items: [
      {
        accountName: "매출액",
        currentPeriod: 150000000000000,
        previousPeriod: 140000000000000,
        unit: "원",
      },
      {
        accountName: "영업이익",
        currentPeriod: 20000000000000,
        previousPeriod: 18000000000000,
        unit: "원",
      },
      {
        accountName: "당기순이익",
        currentPeriod: 15000000000000,
        previousPeriod: 13500000000000,
        unit: "원",
      },
    ],
    fetchedAt: 1696118400000,
  },
};

export const FUTURE_FILING: Filing = {
  receiptNo: "20271001000099",
  corpCode: SAMSUNG_CORP_CODE,
  corpName: SAMSUNG_CORP_NAME,
  stockCode: "005930",
  reportName: "미래 공시 (테스트용)",
  filingType: "정기공시",
  publishedDate: "2027-10-01",
  timePrecision: "date",
  firstSeenAt: 1727740800000,
  url: "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20271001000099",
  isCorrection: false,
};

export const DATE_ONLY_FILING: Filing = {
  receiptNo: "20260920000010",
  corpCode: SAMSUNG_CORP_CODE,
  corpName: SAMSUNG_CORP_NAME,
  stockCode: "005930",
  reportName: "날짜만 있는 공시",
  filingType: "기타공시",
  publishedDate: "2026-09-20",
  timePrecision: "date",
  firstSeenAt: 1695168000000,
  url: "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260920000010",
  isCorrection: false,
};

export function createTestFixtures() {
  return {
    filings: FIXTURE_FILINGS,
    filingDetails: FIXTURE_FILING_DETAILS,
    financials: FIXTURE_FINANCIALS,
  };
}
