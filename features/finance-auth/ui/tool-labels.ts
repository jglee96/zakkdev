/** UI labels for finance agent tools (client-safe; codes shown in tooltips only). */

const TOOL_LABELS_KO: Record<string, string> = {
  create_bot: "봇 생성",
  list_bots: "봇 목록",
  update_bot: "봇 수정",
  invoke_bot: "봇 호출",
  list_reports: "보고서 목록",
  search_dart_filings: "공시 검색",
  get_filing_detail: "공시 상세",
  get_financials: "재무 조회",
  search_sec_filings: "SEC 공시 검색",
  find_relevant_theses: "가설·메모리 조회",
  save_insight: "인사이트 저장",
  create_routine: "루틴 생성",
  list_routines: "루틴 목록",
  pause_routine: "루틴 일시정지",
  resume_routine: "루틴 재개",
  delete_routine: "루틴 삭제",
};

/** Legacy / mock aliases used in fixtures and early seeds */
const TOOL_ALIASES: Record<string, string> = {
  search_disclosure: "search_dart_filings",
  analyze_financials: "get_financials",
  memory_store: "save_insight",
  memory_recall: "find_relevant_theses",
};

export function normalizeToolCode(tool: string): string {
  const key = tool.trim().toLowerCase();
  return TOOL_ALIASES[key] ?? key;
}

export function getToolLabelKo(tool: string): string {
  const code = normalizeToolCode(tool);
  const label = TOOL_LABELS_KO[code];
  if (label) return label;
  return code.replace(/_/g, " ");
}
