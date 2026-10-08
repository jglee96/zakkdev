"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Group, Stack, Text, Title } from "@mantine/core";

export function FinanceHome() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function logout() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/finance/auth/logout", { method: "POST", credentials: "same-origin" });
      if (!response.ok && response.status !== 401) throw new Error("logout failed");
      router.replace("/finance/login");
      router.refresh();
    } catch {
      setError("로그아웃하지 못했습니다. 다시 시도해주세요.");
    } finally { setPending(false); }
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={1} size="h2">금융 리서치</Title>
        <Button variant="subtle" onClick={logout} loading={pending}>로그아웃</Button>
      </Group>
      <Text c="dimmed">금융 분석 기능은 준비 중입니다.</Text>
      {error && <Alert color="red" role="alert">{error}</Alert>}
    </Stack>
  );
}
