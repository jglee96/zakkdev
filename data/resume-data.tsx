import { IconBrandCodepen, IconBrandGithub } from "@tabler/icons-react";

export const RESUME_DATA = {
  name: "zakklee",
  summary:
    "🔭 I’m currently working on TENELEVEN\n🌱 I’m currently learning Three.js, AWS\n🏆 I’m currently working with TypeScript, React\n🏆 I’m interesed in WTF (When To Fetch)",
  about: "about",
  avatarUrl: "https://avatars.githubusercontent.com/u/1017620?v=4",
  contact: {
    email: "zakklee96@gmail.com",
    social: [
      {
        name: "GitHub",
        url: "https://github.com/jglee96",
        icon: IconBrandGithub,
      },
      {
        name: "Codepen",
        url: "https://codepen.io/jglee96",
        icon: IconBrandCodepen,
      },
    ],
  },
  education: [
    {
      school: "Pohang University of Science and Technology",
      degree: "Master's Degree in Electrical Engineering",
      start: "2018",
      end: "2020",
    },
    {
      school: "Pohang University of Science and Technology",
      degree: "Bachelor's Degree in Electrical Engineering",
      start: "2014",
      end: "2018",
    },
  ],
  work: [
    {
      company: "TENELEVEN",
      link: "https://www.1011.co.kr",
      title: "Software Engineer",
      start: "2022",
      end: "current",
      description: "Frontend - React",
    },
    {
      company: "Tmax",
      link: "https://www.tmax.co.kr",
      title: "Software Engineer",
      start: "2020",
      end: "2022",
      description: "Linux, C/C++, React",
    },
  ],
  skills: ["JavaScript", "TypeScript", "React", "PWA"],
  projects: [],
} as const;
