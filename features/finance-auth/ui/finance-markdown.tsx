"use client";

import { Box, Button, Group, Stack, Text, TypographyStylesProvider } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatBlock, ChatSource } from "@/shared/finance/chat/types";
import { StructuredMessageBody } from "./structured-chat-cards";
import classes from "./finance-ui.module.css";

export function FinanceMarkdownBody({ markdown }: { markdown: string }) {
  return (
    <TypographyStylesProvider>
      <Box className="finance-chat-markdown" data-testid="finance-markdown-body">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
      </Box>
    </TypographyStylesProvider>
  );
}

export function CollapsibleRunResultMarkdown({
  content,
  label = "결과",
  preview = true,
  blocks,
  sources,
  datePrecision,
  structuredFallback,
}: {
  content: string;
  label?: string;
  preview?: boolean;
  blocks?: ChatBlock[];
  sources?: ChatSource[];
  datePrecision?: string;
  structuredFallback?: boolean;
}) {
  const [expanded, { toggle }] = useDisclosure(false);
  const longContent = content.length > 280 || content.split("\n").length > 4;

  return (
    <Stack gap={6} data-testid="run-result-markdown">
      <Group justify="space-between" gap="xs" wrap="nowrap">
        <Text size="xs" fw={500} className={classes.sectionLabel} style={{ textTransform: "none", letterSpacing: 0 }}>
          {label}
        </Text>
        {longContent && (
          <Button variant="subtle" size="compact-xs" color="braun-red" onClick={toggle} data-testid="run-result-markdown-toggle">
            {expanded ? "접기" : "더 보기"}
          </Button>
        )}
      </Group>
      <Box
        className={`${classes.markdownPanel} ${preview && longContent && !expanded ? classes.markdownPreview : ""}`}
      >
        {blocks?.length || sources?.length ? (
          <StructuredMessageBody
            bodyMarkdown={content}
            blocks={blocks}
            sources={sources}
            datePrecision={datePrecision}
            structuredFallback={structuredFallback}
          />
        ) : (
          <FinanceMarkdownBody markdown={content} />
        )}
      </Box>
    </Stack>
  );
}
