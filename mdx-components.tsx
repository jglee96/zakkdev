import type { MDXComponents } from "mdx/types";
import NextImage from "next/image";
import { Image } from "@mantine/core";

const components: MDXComponents = {
  img: (props) => <Image component={NextImage} alt={props.alt} {...props} />,
};

export function useMDXComponents(): MDXComponents {
  return components;
}
