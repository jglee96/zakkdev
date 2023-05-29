import Document, {
  Html,
  Head,
  Main,
  NextScript,
  DocumentContext,
} from 'next/document';
import { CssBaseline } from '@nextui-org/react';
import { Children } from 'react';
import Script from 'next/script';

class MyDocument extends Document {
  static async getInitialProps(ctx: DocumentContext) {
    const initialProps = await Document.getInitialProps(ctx);
    return {
      ...initialProps,
      styles: Children.toArray([initialProps.styles]),
    };
  }

  render() {
    return (
      <Html lang="en">
        <Head>
          {CssBaseline.flush()}
          <meta property="og:url" content="zakklee.com" />
          <meta property="og:type" content="website" />
          <meta property="og:title" content="Zakklee's  Blog" />
          <meta
            property="og:description"
            content="Zakklee's Blog made with Next.js, Vercel, Prisma, Supabase"
          />
          <meta property="og:image" content={'/android-chrome-384x384.png'} />
          <link rel="icon" href="/favicon.ico" />
          <link
            rel="apple-touch-icon"
            sizes="180x180"
            href="/apple-touch-icon.png"
          />
          <link
            rel="icon"
            type="image/png"
            sizes="32x32"
            href="/favicon-32x32.png"
          />
          <link
            rel="icon"
            type="image/png"
            sizes="16x16"
            href="/favicon-16x16.png"
          />
          <link rel="manifest" href="/site.webmanifest" />
          <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#5bbad5" />
          <meta name="msapplication-TileColor" content="#da532c" />
          <meta name="theme-color" content="#ffffff" />
          <link
            rel="stylesheet"
            as="style"
            href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.6/dist/web/variable/pretendardvariable-dynamic-subset.css"
          />
          {/* <!-- Google Tag Manager --> */}
          <Script
            id="GTM"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-W8LPMM5');`,
            }}
          ></Script>
          {/* <!-- End Google Tag Manager --> */}
        </Head>
        <body>
          <Main />
          <NextScript />
          {/* <!-- Google Tag Manager (noscript) --> */}
          <noscript
            dangerouslySetInnerHTML={{
              __html: `<iframe src="https://www.googletagmanager.com/ns.html?id=GTM-W8LPMM5" height="0" width="0" style="display:none;visibility:hidden"></iframe>`,
            }}
          ></noscript>
          {/* <!-- End Google Tag Manager (noscript) --> */}
        </body>
      </Html>
    );
  }
}

export default MyDocument;
