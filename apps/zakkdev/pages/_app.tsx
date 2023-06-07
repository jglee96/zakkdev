import '../styles/globals.css';
import '../styles/themes/prism-laserwave.css';
import Footer from '../components/Footer/Footer';
import Head from 'next/head';
import Nav from '../components/Nav/Nav';
import { AppProps } from 'next/app';
import { Divider } from '@mui/material';
import { NextUIProvider, createTheme, Container } from '@nextui-org/react';
import { ThemeProvider } from 'next-themes';
import Script from 'next/script';
import { code, dodum } from '../lib/fonts';
import { useRouter } from 'next/router';

const lightNextTheme = createTheme({
  type: 'light',
});
const darkNextTheme = createTheme({
  type: 'dark',
});

function CustomApp({ Component, pageProps }: AppProps) {
  const router = useRouter();

  return (
    <>
      <Head>
        <title>zakklee.dev</title>
      </Head>
      <main className={`app`}>
        <style jsx global>
          {`
            code,
            pre {
              font-family: ${code.style.fontFamily};
            }
            :root {
              --nextui-fonts-mono: ${dodum.style.fontFamily};
              --nextui-fonts-sans: ${dodum.style.fontFamily};
            }
          `}
        </style>
        {/* <!-- Google Tag Manager --> */}
        <Script
          id="GTM"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-W8LPMM5');`,
          }}
        ></Script>
        {/* <!-- End Google Tag Manager --> */}
        <ThemeProvider
          defaultTheme="system"
          attribute="class"
          value={{
            light: lightNextTheme.className,
            dark: darkNextTheme.className,
          }}
        >
          <NextUIProvider>
            <Nav />
            <Container
              lg
              css={{ flex: 1, padding: '0 $xl', paddingBottom: '$3xl' }}
            >
              <Component {...pageProps} />
            </Container>
            {router.route !== '/' && (
              <Container lg>
                <Divider variant="middle" />
                <Footer />
              </Container>
            )}
          </NextUIProvider>
        </ThemeProvider>
      </main>
    </>
  );
}

export default CustomApp;
