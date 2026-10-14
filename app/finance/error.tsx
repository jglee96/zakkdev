"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Alert, Button, Stack, Text } from "@mantine/core";

export default function FinanceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[finance] page error:", error);
  }, [error]);

  return (
    <Stack gap="md" p="lg" data-testid="finance-page-error">
      <Alert color="red" title="금융 페이지를 불러오지 못했습니다">
        <Text size="sm">
          일시적인 오류이거나 데이터 저장소 설정 문제일 수 있습니다. 다시 시도하거나 로그인 화면으로 돌아가 주세요.
        </Text>
      </Alert>
      <Stack gap="xs">
        <Button variant="light" onClick={() => reset()} data-testid="finance-error-retry">
          다시 시도
        </Button>
        <Button component={Link} href="/finance/login" variant="subtle">
          로그인으로 이동
        </Button>
      </Stack>
    </Stack>
  );
}
