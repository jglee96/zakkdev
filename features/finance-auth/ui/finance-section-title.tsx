"use client";

import { Title, type TitleProps } from "@mantine/core";
import classes from "./finance-ui.module.css";

export function FinanceSectionTitle({ children, ...props }: TitleProps) {
  return (
    <Title order={4} className={classes.sectionTitle} {...props}>
      {children}
    </Title>
  );
}
