"use client";

import {
  ActionIcon,
  Button,
  Flex,
  Group,
  Text,
  useComputedColorScheme,
  useMantineColorScheme,
} from "@mantine/core";
import { IconBlob, IconMoon, IconSun } from "@tabler/icons-react";
import cx from "clsx";

import classes from "./header.module.css";
import Link from "next/link";

export function Header() {
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme("light", {
    getInitialValueInEffect: true,
  });

  return (
    <Flex justify="space-between" align="center" h="100%">
      <Button
        component={Link}
        href="/"
        leftSection={<IconBlob />}
        variant="transparent"
      >
        <Text fw={600} c="text">
          zakklee
        </Text>
      </Button>
      <Group justify="space-between">
        <Text component={Link} href="/posts" fw={600}>
          Posts
        </Text>
        <Text component={Link} href="/about" fw={600}>
          About
        </Text>
        <ActionIcon
          onClick={() =>
            setColorScheme(computedColorScheme === "light" ? "dark" : "light")
          }
          variant="transparent"
          aria-label="Toggle color scheme"
        >
          <IconSun className={cx(classes.icon, classes.light)} stroke={1.5} />
          <IconMoon className={cx(classes.icon, classes.dark)} stroke={1.5} />
        </ActionIcon>
      </Group>
    </Flex>
  );
}
