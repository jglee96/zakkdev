import { Box } from "@mantine/core";

/** Full-width finance shell inside site AppShellMain (no 768px blog column). */
export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <Box
      data-testid="finance-layout-bleed"
      w="100%"
      maw="100%"
      pt={{ base: 8, sm: 12 }}
      pb={{ base: 24, sm: 32 }}
      style={{ boxSizing: "border-box", overflowX: "clip", minWidth: 0 }}
    >
      {children}
    </Box>
  );
}
