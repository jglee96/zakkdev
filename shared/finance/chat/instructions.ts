export const STRUCTURED_FINISH_INSTRUCTION = `최종 답변은 반드시 respond 도구를 호출해 제출하세요.
- bodyMarkdown: 사용자용 마크다운 (출처 목록/URL 목록을 본문에 넣지 마세요)
- blocks: disclosure/thesis/financials/markdown 카드. disclosure·thesis·financials는 수집된 sourceId만 참조
- datePrecision: 공시일만 있는 경우 등 실제로 알 수 있는 정확도만 기술 (없는 시각을 만들지 마세요)
URL이나 접수번호를 상상하지 마세요. 도구가 반환한 출처만 사용합니다.`;
