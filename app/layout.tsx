import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import {
  AppShell,
  AppShellHeader,
  AppShellMain,
  ColorSchemeScript,
  createTheme,
  MantineColorsTuple,
  MantineProvider,
} from "@mantine/core";

import "@mantine/core/styles.css";
import { Header } from "@/components/header";

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
    <html lang="kr" className={inter.className}>
      <head>
        <ColorSchemeScript />
      </head>
      <body>
        {/* <!-- Google Tag Manager --> */}
        <Script
          id="GTM"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-W8LPMM5');`,
          }}
        ></Script>
        {/* <!-- End Google Tag Manager --> */}
        {/* <!-- Google Tag Manager (noscript) --> */}
        <noscript
          dangerouslySetInnerHTML={{
            __html: `<iframe src="https://www.googletagmanager.com/ns.html?id=GTM-W8LPMM5" height="0" width="0" style="display:none;visibility:hidden"></iframe>`,
          }}
        ></noscript>
        {/* <!-- End Google Tag Manager (noscript) --> */}
        <MantineProvider theme={theme}>
          <AppShell header={{ height: 84 }} padding="md">
            <AppShellHeader>
              <Header />
            </AppShellHeader>
            <AppShellMain>{children}</AppShellMain>
          </AppShell>
        </MantineProvider>
      </body>
    </html>
  );
}
