import { Center } from "@mantine/core";
import classes from "./page.module.css";
import cx from "clsx";

export default function Page() {
  return (
    <Center w="100%" h="100%" bg="dark">
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
