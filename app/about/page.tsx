import { RESUME_DATA } from "@/data/resume-data";
import {
  Title,
  Text,
  Flex,
  Anchor,
  Stack,
  Badge,
  Space,
  ActionIcon,
  Group,
} from "@mantine/core";
import classes from "./page.module.css";
import { IconMail } from "@tabler/icons-react";

export default function About() {
  return (
    <>
      <Title>{RESUME_DATA.name}</Title>
      <Text className={classes.summary}>{RESUME_DATA.summary}</Text>
      <Space h="xs" />
      <Group gap="xs">
        <ActionIcon
          component="a"
          variant="outline"
          href={`mailto:${RESUME_DATA.contact.email}`}
        >
          <IconMail />
        </ActionIcon>
        {RESUME_DATA.contact.social.map((item) => (
          <ActionIcon
            key={item.name}
            component="a"
            variant="outline"
            href={item.url}
          >
            <item.icon />
          </ActionIcon>
        ))}
      </Group>
      <Space h="md" />
      {/* <Title>About</Title>
      <Text>{RESUME_DATA.about}</Text> */}
      <Space h="md" />
      <Title>Work Experience</Title>
      {RESUME_DATA.work.map((item) => (
        <Stack key={item.company} gap={2} my="md">
          <Flex justify="space-between">
            <Anchor
              fz="lg"
              fw={700}
              href={item.link}
              c="var(--mantine-color-text)"
            >
              {item.company}
            </Anchor>
            <Text>{`${item.start} - ${item.end}`}</Text>
          </Flex>
          <Text>{item.title}</Text>
          <Text>{item.description}</Text>
        </Stack>
      ))}
      <Title>Education</Title>
      {RESUME_DATA.education.map((item) => (
        <Stack key={item.degree} gap={2} my="md">
          <Flex justify="space-between">
            <Text fz="lg" fw={700}>
              {item.school}
            </Text>
            <Text>{`${item.start} - ${item.end}`}</Text>
          </Flex>
          <Text>{item.degree}</Text>
        </Stack>
      ))}
      <Title>Skills</Title>
      <Flex gap={4}>
        {RESUME_DATA.skills.map((item) => (
          <Badge key={item} radius="md">
            {item}
          </Badge>
        ))}
      </Flex>
    </>
  );
}
