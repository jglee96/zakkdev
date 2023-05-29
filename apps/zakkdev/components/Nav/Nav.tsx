import { useRouter } from 'next/router';
import { Navbar, Text, Switch, useTheme } from '@nextui-org/react';
import { useTheme as useNextTheme } from 'next-themes';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';

const Nav = () => {
  const router = useRouter();
  const { setTheme } = useNextTheme();
  const { isDark } = useTheme();

  return (
    <Navbar isBordered variant="floating">
      <Navbar.Brand>
        <Text b>Zakklee</Text>
      </Navbar.Brand>
      <Navbar.Content variant="highlight">
        <Navbar.Link isActive={router.asPath === '/'} href="/">
          Home
        </Navbar.Link>
        <Navbar.Link isActive={router.asPath.includes('/blog')} href="/blog">
          Blog
        </Navbar.Link>
        <Navbar.Link isActive={router.asPath.includes('/map')} href="/map">
          Map
        </Navbar.Link>
      </Navbar.Content>
      <Switch
        checked={isDark}
        iconOn={<DarkModeOutlinedIcon />}
        iconOff={<LightModeOutlinedIcon />}
        onChange={(e) => setTheme(e.target.checked ? 'dark' : 'light')}
      />
    </Navbar>
  );
};

export default Nav;
