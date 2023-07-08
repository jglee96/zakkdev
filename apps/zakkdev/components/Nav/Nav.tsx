'use client';

import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from '@zakkdev/ui';
import DarkModeSelector from '@/components/DarkModeSelector/DarkModeSelector';
import Link from 'next/link';

const Nav = () => {
  return (
    <div className="fixed w-full top-2 px-4 pt-2 pb-6 z-10">
      <NavigationMenu className="max-w-none w-full h-16 align-middle justify-between shadow-lg shadow-secondary rounded-xl p-2 bg-background">
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
    </div>
  );
};

export default Nav;
