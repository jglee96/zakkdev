import { Metadata } from 'next';
import Script from 'next/script';
import Nav from '@/components/Nav/Nav';
import { Inter } from 'next/font/google';
import '@/styles/styles.css';

export const metadata: Metadata = {
  title: 'zakklee.dev',
  description: "Zakklee's Blog made with Nx, Next.js, Vercel",
  themeColor: '#ffffff',
  openGraph: {
    title: "Zakklee's  Blog",
    url: 'zakklee.dev',
    type: 'website',
    description: "Zakklee's Blog made with Nx, Next.js, Vercel",
    images: '/android-chrome-384x384.png',
  },
  icons: [
    { rel: 'icon', url: '/favicon.ico' },
    { rel: 'apple-touch-icon', sizes: '180x180', url: '/apple-touch-icon.png' },
    {
      rel: 'icon',
      type: 'image/png',
      sizes: '32x32',
      url: '/favicon-32x32.png',
    },
    {
      rel: 'icon',
      type: 'image/png',
      sizes: '16x16',
      url: '/favicon-16x16.png',
    },
  ],
  manifest: '/site.webmanifest',
};

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
});

export default function RootLayout({
  // Layouts must accept a children prop.
  // This will be populated with nested layouts or pages
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.className}>
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
        <Nav />
        <section className="mx-4 mt-28 pb-8">{children}</section>
      </body>
    </html>
  );
}
