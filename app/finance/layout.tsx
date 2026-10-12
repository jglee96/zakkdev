import { Box } from "@mantine/core";

/**
 * Finance routes use their own AppShell. Stay within the site main column width
 * (no 100vw bleed) to avoid horizontal overflow on desktop.
 */
export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <Box
      data-testid="finance-layout-bleed"
      w="100%"
      maw="100%"
      style={{
        boxSizing: "border-box",
        overflowX: "clip",
        marginTop: -8,
        marginBottom: -24,
      }}
    >
      {children}
    </Box>
  );
}
