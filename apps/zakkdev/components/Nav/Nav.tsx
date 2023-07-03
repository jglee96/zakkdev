'use client';

import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
  Button,
} from '@zakkdev/ui';
import { LockClosedIcon } from '@radix-ui/react-icons';
import DarkModeSelector from '../DarkModeSelector/DarkModeSelector';
import { supabase } from '../../lib/supabase';
import Link from 'next/link';

const Nav = () => {
  return (
    <NavigationMenu className="max-w-none align-middle justify-between">
      <div>Zakklee</div>
      <NavigationMenuList className="center">
        <NavigationMenuItem>
          <Link id="home_page" href="/">
            <NavigationMenuLink className={navigationMenuTriggerStyle()}>
              Home
            </NavigationMenuLink>
          </Link>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <Link id="blog_page" href="/blog">
            <NavigationMenuLink className={navigationMenuTriggerStyle()}>
              Blog
            </NavigationMenuLink>
          </Link>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <Link id="map_page" href="/map">
            <NavigationMenuLink className={navigationMenuTriggerStyle()}>
              Map
            </NavigationMenuLink>
          </Link>
        </NavigationMenuItem>
      </NavigationMenuList>
      <div>
        <Button
          variant="ghost"
          size="icon"
          onClick={async () => {
            const { data, error } = await supabase.auth.signInWithOAuth({
              provider: 'github',
            });
            console.log(data, error);
          }}
        >
          <LockClosedIcon />
        </Button>
        <DarkModeSelector />
      </div>
    </NavigationMenu>
  );
};

export default Nav;
