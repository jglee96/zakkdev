import { useRouter } from 'next/router';
import { Button, Navbar, Text } from '@nextui-org/react';
import DarkModeSelector from '../DarkModeSelector/DarkModeSelector';
import { supabase } from '../../lib/supabase';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';

const Nav = () => {
  const router = useRouter();

  return (
    <Navbar isBordered variant="floating">
      <Navbar.Brand>
        <Text b>Zakklee</Text>
      </Navbar.Brand>
      <Navbar.Content variant="highlight" activeColor="secondary">
        <Navbar.Link id="home_page" isActive={router.asPath === '/'} href="/">
          Home
        </Navbar.Link>
        <Navbar.Link
          id="blog_page"
          isActive={router.asPath.includes('/blog')}
          href="/blog"
        >
          Blog
        </Navbar.Link>
        <Navbar.Link
          id="map_page"
          isActive={router.asPath.includes('/map')}
          href="/map"
        >
          Map
        </Navbar.Link>
      </Navbar.Content>
      <Button.Group color="secondary">
        <Button
          icon={<AdminPanelSettingsIcon />}
          onClick={async () => {
            const { data, error } = await supabase.auth.signInWithOAuth({
              provider: 'github',
            });
            console.log(data, error);
          }}
        />
        <DarkModeSelector />
      </Button.Group>
    </Navbar>
  );
};

export default Nav;
