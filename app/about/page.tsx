import { RESUME_DATA } from "@/data/resume-data";
import { Title, Text, Flex, Anchor, Stack, Badge } from "@mantine/core";

export default function About() {
  return (
    <>
      <Title>{RESUME_DATA.name}</Title>
      <Text>{RESUME_DATA.summary}</Text>
      <Title>About</Title>
      <Text>{RESUME_DATA.about}</Text>
      <Title>Work Experience</Title>
      {RESUME_DATA.work.map((item) => (
        <Stack key={item.company} gap={2} my="xl">
          <Flex justify="space-between">
            <Anchor fz="lg" fw={700} href={item.link} c="text">
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
        <Stack key={item.degree} gap={2} my="xl">
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
