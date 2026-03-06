"use client";

import { PROJECT_DATA } from "@/entities/project";
import { Box, Flex, Text } from "@mantine/core";
import dayjs from "dayjs";
import Link from "next/link";

export function ProjectsPage() {
  return (
    <>
      {PROJECT_DATA.map(({ title, summary, writeDate, editDate }) => (
        <Box key={title} maw={840} my="md">
          <Text
            component={Link}
            href={`/projects/${title.toLowerCase().replaceAll(" ", "-")}`}
            fw={700}
            fz="xl"
          >
            {title}
          </Text>
          <Text c="dimmed">{summary}</Text>
          <Flex gap="xs" justify="start" align="center">
            <Text c="dimmed" fz="xs">
              Write: {dayjs(writeDate).format("YYYY-MM-DD")}
            </Text>
            {writeDate !== editDate && (
              <Text c="dimmed" fz="xs">
                Last Edit: {dayjs(editDate).format("YYYY-MM-DD")}
              </Text>
            )}
          </Flex>
        </Box>
      ))}
    </>
  );
}
