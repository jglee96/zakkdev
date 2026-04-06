"use client";

import {
  ActionIcon,
  Flex,
  Group,
  Text,
  useComputedColorScheme,
  useMantineColorScheme,
} from "@mantine/core";
import { IconMoon, IconSun } from "@tabler/icons-react";
import cx from "clsx";

import classes from "./site-header.module.css";
import Link from "next/link";

const navItems = [
  { label: "Projects", href: "/projects" },
  { label: "Blog", href: "/blog" },
  { label: "AI", href: "/ai" },
  { label: "About", href: "https://www.linkedin.com/in/zakklee", external: true },
];

export function SiteHeader() {
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme("light", {
    getInitialValueInEffect: true,
  });

  return (
    <Flex justify="space-between" align="center" h="100%">
      <Text
        component={Link}
        href="/"
        fw={400}
        fz="md"
        style={{ textDecoration: "none", letterSpacing: "0" }}
        c="var(--mantine-color-text)"
      >
        zakklee
      </Text>
      <Group gap={24} className={classes.nav}>
        {navItems.map((item) =>
          item.external ? (
            <Text
              key={item.label}
              component="a"
              href={item.href}
              target="_blank"
              fz="12px"
              fw={400}
              tt="uppercase"
              lts="0.1em"
              className={classes.navLink}
            >
              {item.label}
            </Text>
          ) : (
            <Text
              key={item.label}
              component={Link}
              href={item.href}
              fz="12px"
              fw={400}
              tt="uppercase"
              lts="0.1em"
              className={classes.navLink}
            >
              {item.label}
            </Text>
          )
        )}
        <ActionIcon
          onClick={() =>
            setColorScheme(computedColorScheme === "light" ? "dark" : "light")
          }
          variant="transparent"
          aria-label="Toggle color scheme"
        >
          <IconSun className={cx(classes.icon, classes.light)} stroke={1.2} />
          <IconMoon className={cx(classes.icon, classes.dark)} stroke={1.2} />
        </ActionIcon>
      </Group>
    </Flex>
  );
}
