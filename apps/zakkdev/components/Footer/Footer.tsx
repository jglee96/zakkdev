import { Button, Grid } from '@nextui-org/react';
import GitHubIcon from '@mui/icons-material/GitHub';
import ArticleIcon from '@mui/icons-material/Article';
import Link from 'next/link';

const Footer = () => {
  return (
    <Grid.Container css={{ padding: '$xs 0' }}>
      <Grid xs></Grid>
      <Grid xs={6}></Grid>
      <Grid xs>
        <Grid.Container gap={1} css={{ justifyContent: 'flex-end' }}>
          <Grid>
            <Link target="_blank" href="https://github.com/jglee96">
              <Button
                aria-label="github link"
                icon={<GitHubIcon />}
                color="gradient"
                auto
              />
            </Link>
          </Grid>
          <Grid>
            <Link target="_blank" href="https://jglee96.tistory.com/">
              <Button
                aria-label="tistory blog"
                target="_blank"
                href="https://jglee96.tistory.com/"
                icon={<ArticleIcon />}
                color="gradient"
                auto
              />
            </Link>
          </Grid>
        </Grid.Container>
      </Grid>
    </Grid.Container>
  );
};

export default Footer;
