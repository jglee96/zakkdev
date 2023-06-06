import Document, {
  Html,
  Head,
  Main,
  NextScript,
  DocumentContext,
} from 'next/document';
import { CssBaseline } from '@nextui-org/react';
import { Children } from 'react';

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
          <meta property="og:url" content="zakklee.dev" />
          <meta property="og:type" content="website" />
          <meta property="og:title" content="Zakklee's  Blog" />
          <meta
            property="og:description"
            content="Zakklee's Blog made with Nx, Next.js, Vercel"
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
          <meta
            name="description"
            content="Zakklee's Blog made with Nx, Next.js, Vercel"
          ></meta>
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
