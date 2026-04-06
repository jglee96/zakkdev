import { Center } from "@mantine/core";
import classes from "./project-3d-css-page.module.css";
import cx from "clsx";

export function Project3dCssPage() {
  return (
    <Center
      bg="dark"
      style={{
        position: "fixed",
        inset: 0,
        top: "var(--app-shell-header-height, 64px)",
      }}
    >
      <section className={cx(classes.container, classes.diagram)}>
        <div className={cx(classes.side, classes.front)}>
          <header className={classes.header}>
            <div className={classes.shape}>
              <div className={cx(classes.rectangle_md, classes.body)}></div>
              <div className={cx(classes.rectangle_md, classes.border)}></div>
            </div>
            <div className={classes.shape}>
              <div className={cx(classes.square, classes.body)}></div>
              <div className={cx(classes.square, classes.border)}></div>
            </div>
          </header>
          <div className={classes.shape}>
            <div className={cx(classes.rectangle_lg, classes.body)}></div>
            <div className={cx(classes.rectangle_lg, classes.border)}></div>
          </div>
        </div>
        <div className={cx(classes.side, classes.back)}></div>
      </section>
    </Center>
  );
}
