'use client';

import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
  Button,
} from '@zakkdev/ui';
import DarkModeSelector from '../DarkModeSelector/DarkModeSelector';
import { supabase } from '../../lib/supabase';
import Link from 'next/link';

const Nav = () => {
  return (
    <NavigationMenu>
      <NavigationMenuList>
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
      <Button
        onClick={async () => {
          const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'github',
          });
          console.log(data, error);
        }}
      />
      <DarkModeSelector />
    </NavigationMenu>
  );
};

export default Nav;
