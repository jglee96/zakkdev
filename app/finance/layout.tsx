import { Box } from "@mantine/core";

/** Full-width finance shell inside site AppShellMain (no 768px blog column). */
export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <Box
      data-testid="finance-layout-bleed"
      w="100%"
      maw="100%"
      pt={0}
      pb={0}
      style={{
        boxSizing: "border-box",
        overflowX: "clip",
        minWidth: 0,
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        height: `calc(100dvh - var(--site-app-shell-header-height, 64px))`,
      }}
    >
      {children}
    </Box>
  );
}
