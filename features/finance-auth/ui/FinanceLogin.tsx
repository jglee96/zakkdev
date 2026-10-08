"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, PasswordInput, Stack, Text, Title } from "@mantine/core";

export function FinanceLogin() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/finance/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }), credentials: "same-origin",
      });
      const data = await response.json();
      if (!response.ok) {
        setError(typeof data.error === "string" ? data.error : "로그인하지 못했습니다.");
        return;
      }
      router.replace("/finance");
      router.refresh();
    } catch {
      setError("연결하지 못했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setPassword("");
      setPending(false);
    }
  }

  return (
    <Stack maw={360} mx="auto" gap="lg">
      <div>
        <Title order={1} size="h2">금융 리서치 로그인</Title>
        <Text c="dimmed" mt="xs">소유자만 사용할 수 있는 개인 공간입니다.</Text>
      </div>
      <form onSubmit={login}>
        <Stack>
          <PasswordInput label="비밀번호" name="password" autoComplete="current-password"
            required value={password} onChange={(event) => setPassword(event.currentTarget.value)}
            disabled={pending} maxLength={1024} />
          {error && <Alert color="red" role="alert">{error}</Alert>}
          <Button type="submit" loading={pending}>로그인</Button>
        </Stack>
      </form>
    </Stack>
  );
}
