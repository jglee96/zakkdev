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
    <NavigationMenu className="sticky top-2 max-w-none h-16 align-middle justify-between bg-slate-50 shadow-lg mx-4 my-2 rounded-sm p-2">
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
