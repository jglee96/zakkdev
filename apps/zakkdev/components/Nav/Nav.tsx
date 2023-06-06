import { useRouter } from 'next/router';
import { Navbar, Text } from '@nextui-org/react';
import DarkModeSelector from '../DarkModeSelector/DarkModeSelector';

const Nav = () => {
  const router = useRouter();

  return (
    <Navbar isBordered variant="floating">
      <Navbar.Brand>
        <Text b>Zakklee</Text>
      </Navbar.Brand>
      <Navbar.Content variant="highlight" activeColor="secondary">
        <Navbar.Link id="home" isActive={router.asPath === '/'} href="/">
          Home
        </Navbar.Link>
        <Navbar.Link
          id="blog"
          isActive={router.asPath.includes('/blog')}
          href="/blog"
        >
          Blog
        </Navbar.Link>
        <Navbar.Link
          id="map"
          isActive={router.asPath.includes('/map')}
          href="/map"
        >
          Map
        </Navbar.Link>
      </Navbar.Content>
      <DarkModeSelector />
    </Navbar>
  );
};

export default Nav;
