import { Box } from "@mantine/core";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <Box
      px={{ base: 20, sm: 0 }}
      pt={{ base: 28, sm: 40 }}
      pb={{ base: 40, sm: 60 }}
      style={{ maxWidth: 768, marginLeft: "auto", marginRight: "auto" }}
    >
      {children}
    </Box>
  );
}
