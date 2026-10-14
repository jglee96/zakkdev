"use client";

import { useEffect, useState } from "react";
import { Box, Button, Card, Group, Stack, Text } from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import { BOT_TEMPLATE_CATALOG } from "./bot-template-meta";
import classes from "./finance-ui.module.css";

const STORAGE_KEY = "finance-onboarding-v1-dismissed";

export function useOnboardingVisible(specialistBotCount: number) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(STORAGE_KEY) === "1";
      setVisible(!dismissed);
    } catch {
      setVisible(true);
    }
  }, [specialistBotCount]);

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  return { visible, dismiss };
}

export function FinanceOnboarding({
  specialistBotCount,
  onCreateBot,
  onStarterPrompt,
}: {
  specialistBotCount: number;
  onCreateBot: () => void;
  onStarterPrompt: (text: string) => void;
}) {
  const { visible, dismiss } = useOnboardingVisible(specialistBotCount);
  if (!visible) return null;

  const specialists = BOT_TEMPLATE_CATALOG.filter((t) => t.template !== "main");

  return (
    <Card
      withBorder={false}
      p="md"
      mb="sm"
      classNames={{ root: classes.surfaceCard }}
      data-testid="finance-onboarding"
    >
      <Group justify="space-between" align="flex-start" wrap="nowrap" mb="xs">
        <Text size="sm" fw={500}>금융 리서치 봇 안내</Text>
        <Button
          variant="subtle"
          size="compact-xs"
          color="gray"
          onClick={dismiss}
          aria-label="안내 닫기"
          data-testid="finance-onboarding-dismiss"
        >
          <IconX size={14} />
        </Button>
      </Group>
      <Stack gap="xs">
        <Text size="sm" className={classes.loginIntro}>
          <strong>메인 봇</strong>은 전체 흐름을 조율하고, 아래 전문 템플릿으로 <strong>새 Bot</strong>을 만들 수 있습니다.
          사이드바에서 봇을 바꾸면 대화 기록이 봇마다 따로 유지됩니다.
        </Text>
        <Box component="ul" style={{ margin: 0, paddingLeft: 18 }} className={classes.loginIntro}>
          {specialists.map((t) => (
            <li key={t.template}>
              <Text span size="sm">{t.label}</Text>
              <Text span size="xs" className={classes.muted}> — {t.roleLine}</Text>
            </li>
          ))}
        </Box>
        <Group gap="xs" mt="xs" wrap="wrap">
          <Button size="xs" variant="light" color="braun-red" onClick={onCreateBot} data-testid="onboarding-create-bot">
            새 Bot 만들기
          </Button>
          <Button
            size="xs"
            variant="subtle"
            onClick={() => onStarterPrompt("삼성전자 최근 공시 분석해줘")}
            data-testid="onboarding-starter-analysis"
          >
            공시 분석 예시
          </Button>
          <Button
            size="xs"
            variant="subtle"
            onClick={() => onStarterPrompt("오늘 시장에서 주목할 뉴스를 요약해줘")}
            data-testid="onboarding-starter-market"
          >
            시장 요약 예시
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
