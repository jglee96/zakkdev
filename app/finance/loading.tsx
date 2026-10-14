import { Box, Loader, Stack, Text } from "@mantine/core";

export default function FinanceLoading() {
  return (
    <Box
      data-testid="finance-page-loading"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flex: 1,
        minHeight: "40vh",
      }}
    >
      <Stack align="center" gap="sm">
        <Loader size="lg" />
        <Text size="sm" c="dimmed">금융 워크스페이스 불러오는 중…</Text>
      </Stack>
    </Box>
  );
}
