# Finance structured chat output

## Flow

1. Tool results (DART filings, thesis evidence) populate a per-run `SourceRegistry` (server-side only).
2. The model finishes via the `respond` tool with `{ bodyMarkdown, datePrecision?, blocks[] }` validated by Zod.
3. Block `sourceId` / `evidenceSourceIds` must match collected sources; unknown IDs are dropped.
4. If the model returns plain text instead of `respond`, the runtime uses markdown fallback (no extra LLM repair for non-JSON drafts). Invalid JSON may trigger one repair LLM call (counts toward budget).
5. Assistant messages persist `content` (body markdown) plus `sources`, `blocks`, `datePrecision`, `structuredFallback` in DynamoDB.

## UI

- `StructuredMessageBody` renders `DisclosureCard`, `ThesisCard`, `FinancialsCard`.
- Legacy messages use `legacy-assistant-message.ts` regex parser.
