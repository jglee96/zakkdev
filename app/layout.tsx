import type { Metadata } from "next";
import { Barlow } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import {
  AppShell,
  AppShellHeader,
  AppShellMain,
  Box,
  ColorSchemeScript,
  createTheme,
  MantineColorsTuple,
  mantineHtmlProps,
  MantineProvider,
} from "@mantine/core";
import { SiteHeader } from "@/widgets/site-header";
import { AppRoot } from "@/widgets/app-root/AppRoot";
import { ModalRoot } from "@/widgets/modal-root/ModalRoot";
import { SITE_APP_SHELL_HEADER_HEIGHT_PX } from "@/shared/site-layout/constants";

import "@mantine/core/styles.css";
import "./globals.css";

const barlow = Barlow({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

const braunCream: MantineColorsTuple = [
  "#FDFCF9",
  "#F4F1EC",
  "#E8E3DB",
  "#DAD4CA",
  "#C9C3B8",
  "#B5AFA4",
  "#9E9890",
  "#86807A",
  "#5E5A56",
  "#1C1917",
];

const braunRed: MantineColorsTuple = [
  "#FEF0EC",
  "#FBDBD2",
  "#F4B3A0",
  "#EB876C",
  "#DF5F3A",
  "#C74219",
  "#A83614",
  "#882B10",
  "#65200C",
  "#451608",
];

const theme = createTheme({
  primaryColor: "braun-red",
  colors: {
    "braun-cream": braunCream,
    "braun-red": braunRed,
  },
  fontFamily: barlow.style.fontFamily,
  headings: {
    fontFamily: barlow.style.fontFamily,
    fontWeight: "300",
    sizes: {
      h1: { fontSize: "48px", lineHeight: "1.1" },
      h2: { fontSize: "20px", lineHeight: "1.3", fontWeight: "400" },
      h3: { fontSize: "17px", lineHeight: "1.4", fontWeight: "400" },
    },
  },
  fontSizes: {
    xs: "11px",
    sm: "13px",
    md: "15px",
    lg: "17px",
    xl: "20px",
  },
  lineHeights: {
    xs: "1.4",
    sm: "1.5",
    md: "1.8",
    lg: "1.7",
    xl: "1.5",
  },
});

export const metadata: Metadata = {
  metadataBase: new URL("https://zakklee.dev"),
  title: "zakklee.dev",
  description: "Zakklee's Blog made with Next.js, Vercel",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="kr" className={barlow.className} {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript />
      </head>
      <body>
        <Analytics />
        <SpeedInsights />
        <AppRoot>
          <MantineProvider theme={theme}>
            <AppShell header={{ height: SITE_APP_SHELL_HEADER_HEIGHT_PX }} padding={0}>
              <AppShellHeader
                px={{ base: 20, sm: 80, md: 160, xl: 340 }}
                style={{ borderBottom: "1px solid #DDD8D2", zIndex: 250 }}
                data-testid="site-app-shell-header"
              >
                <SiteHeader />
              </AppShellHeader>
              <AppShellMain
                style={{
                  overflowX: "clip",
                  width: "100%",
                  maxWidth: "100%",
                  display: "flex",
                  flexDirection: "column",
                  minHeight: 0,
                  ["--site-app-shell-header-height" as string]: `${SITE_APP_SHELL_HEADER_HEIGHT_PX}px`,
                }}
              >
                {children}
              </AppShellMain>
            </AppShell>
          </MantineProvider>
        </AppRoot>
        <ModalRoot />
      </body>
    </html>
  );
}
