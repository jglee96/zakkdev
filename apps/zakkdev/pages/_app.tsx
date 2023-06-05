import '../styles/globals.css';
import '../styles/themes/prism-laserwave.css';
import Footer from '../components/Footer/Footer';
import Head from 'next/head';
import Nav from '../components/Nav/Nav';
import { AppProps } from 'next/app';
import { Divider } from '@mui/material';
import { NextUIProvider, createTheme, Container } from '@nextui-org/react';
import { ThemeProvider } from 'next-themes';
import { Gowun_Dodum } from 'next/font/google';

const lightNextTheme = createTheme({
  type: 'light',
});
const darkNextTheme = createTheme({
  type: 'dark',
});
const font = Gowun_Dodum({
  weight: '400',
  subsets: ['latin'],
});

function CustomApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>zakklee.dev</title>
      </Head>
      <main className={`app ${font.className}`}>
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
              css={{ flex: 1, padding: '0 $2xl', paddingBottom: '$3xl' }}
            >
              <Component {...pageProps} />
            </Container>
            <Container lg>
              <Divider variant="middle" />
              <Footer />
            </Container>
          </NextUIProvider>
        </ThemeProvider>
      </main>
    </>
  );
}

export default CustomApp;
