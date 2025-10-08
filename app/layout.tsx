import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import {
  AppShell,
  AppShellHeader,
  AppShellMain,
  ColorSchemeScript,
  createTheme,
  MantineColorsTuple,
  mantineHtmlProps,
  MantineProvider,
} from "@mantine/core";
import { Header } from "@/components/header";

import "@mantine/core/styles.css";

const inter = Inter({ subsets: ["latin"] });

const myColor: MantineColorsTuple = [
  "#f3f3fe",
  "#e4e6ed",
  "#c8cad3",
  "#a9adb9",
  "#9093a4",
  "#808496",
  "#767c91",
  "#656a7e",
  "#585e72",
  "#4a5167",
];

const theme = createTheme({
  primaryColor: "blue-gray",
  colors: {
    "blue-gray": myColor,
  },
});

export const metadata: Metadata = {
  title: "zakklee.dev",
  description: "Zakklee's Blog made with Next.js, Vercel",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="kr" className={inter.className} {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript />
      </head>
      <body>
        <Analytics />
        <SpeedInsights />
        <MantineProvider theme={theme}>
          <AppShell header={{ height: 84 }} padding="md">
            <AppShellHeader mx={{ sm: 80, md: 160, xl: 340 }} px={16}>
              <Header />
            </AppShellHeader>
            <AppShellMain mx={{ sm: 80, md: 160, xl: 340 }} h="100dvh">
              {children}
            </AppShellMain>
          </AppShell>
        </MantineProvider>
      </body>
    </html>
  );
}
