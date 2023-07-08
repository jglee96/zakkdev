'use client';

import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from '@zakkdev/ui';
import DarkModeSelector from '../DarkModeSelector/DarkModeSelector';
import Link from 'next/link';

const Nav = () => {
  return (
    <NavigationMenu className="sticky top-2 max-w-none h-16 align-middle justify-between bg-white shadow-lg mx-4 mt-2 mb-6 rounded-xl p-2">
      <div className="font-bold">Zakklee</div>
      <NavigationMenuList className="center">
        <NavigationMenuItem>
          <Link id="home_page" href="/" legacyBehavior passHref>
            <NavigationMenuLink className={navigationMenuTriggerStyle()}>
              Home
            </NavigationMenuLink>
          </Link>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <Link id="blog_page" href="/blog" legacyBehavior passHref>
            <NavigationMenuLink className={navigationMenuTriggerStyle()}>
              Blog
            </NavigationMenuLink>
          </Link>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <Link id="map_page" href="/map" legacyBehavior passHref>
            <NavigationMenuLink className={navigationMenuTriggerStyle()}>
              Map
            </NavigationMenuLink>
          </Link>
        </NavigationMenuItem>
      </NavigationMenuList>
      <div>
        <DarkModeSelector />
      </div>
    </NavigationMenu>
  );
};

export default Nav;
