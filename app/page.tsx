import { Text, Title } from "@mantine/core";
import classes from "./page.module.css";
import { RESUME_DATA } from "@/data/resume-data";

export default function Home() {
  return (
    <>
      <Title>{RESUME_DATA.name}</Title>
      <Text>{RESUME_DATA.about}</Text>
      <Text>Lastest Posts</Text>
    </>
  );
}
