import { Box } from "@mantine/core";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <Box
      px={{ base: 20, sm: 0 }}
      pt={{ base: 28, sm: 40 }}
      pb={{ base: 40, sm: 60 }}
      maw={768}
      mx={{ base: "auto", sm: 80, md: 160, xl: 340 }}
    >
      {children}
    </Box>
  );
}
