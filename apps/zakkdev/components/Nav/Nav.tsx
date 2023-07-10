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
import { useMemo } from 'react';

const Nav = () => {
  const triggerStyle = useMemo(
    () => `${navigationMenuTriggerStyle()} xs:px-0 sm:px-4 md:px-4 bg-inherit`,
    []
  );
  return (
    <div className="sticky w-full top-2 px-4 pt-2 pb-10 z-10 prose-ul:p-0 prose-li:m-0">
      <NavigationMenu className="max-w-none w-full h-16 align-middle justify-between shadow-lg shadow-secondary rounded-xl p-2 bg-background/60 backdrop-blur-sm border-border border-2">
        <div className="font-bold">Zakklee</div>
        <NavigationMenuList className="center">
          <NavigationMenuItem>
            <Link id="home_page" href="/" legacyBehavior passHref>
              <NavigationMenuLink className={triggerStyle}>
                Home
              </NavigationMenuLink>
            </Link>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <Link id="blog_page" href="/blog" legacyBehavior passHref>
              <NavigationMenuLink className={triggerStyle}>
                Blog
              </NavigationMenuLink>
            </Link>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <Link id="map_page" href="/map" legacyBehavior passHref>
              <NavigationMenuLink className={triggerStyle}>
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
