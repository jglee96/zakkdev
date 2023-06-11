import {
  Button,
  Card,
  Grid,
  Link,
  Text,
  Tooltip,
  Image,
  Spacer,
} from '@nextui-org/react';
import GitHubIcon from '@mui/icons-material/GitHub';
import ArticleIcon from '@mui/icons-material/Article';
import ViewInArIcon from '@mui/icons-material/ViewInAr';

interface Props {
  html: string;
}

export function Index({ html }: Props) {
  return (
    <Grid.Container>
      <Grid xs={12} sm={6}>
        <Card css={{ margin: '$10', maxW: '450px' }}>
          <Card.Header css={{ position: 'absolute', zIndex: 1, top: 5 }}>
            <Text h3 color="black">
              Zakklee (jglee96)
            </Text>
          </Card.Header>
          <Card.Body css={{ p: 0 }}>
            <Card.Image
              src="/canada.webp"
              width="100%"
              height="498px"
              objectFit="cover"
            />
          </Card.Body>
          <Card.Footer
            isBlurred
            css={{
              position: 'absolute',
              bgBlur: '#ffffff66',
              borderTop: '$borderWeights$light solid rgba(255, 255, 255, 0.2)',
              bottom: 0,
              zIndex: 1,
            }}
          >
            <Grid.Container gap={1}>
              <Grid>
                <Tooltip content="github">
                  <Link target="_blank" href="https://github.com/jglee96">
                    <Button
                      aria-label="github"
                      icon={<GitHubIcon />}
                      color="gradient"
                      auto
                    />
                  </Link>
                </Tooltip>
              </Grid>
              <Grid>
                <Tooltip content="blog">
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
                </Tooltip>
              </Grid>
              <Grid>
                <Tooltip content="codepen">
                  <Link target="_blank" href="https://codepen.io/jglee96">
                    <Button
                      aria-label="codepen"
                      icon={<ViewInArIcon />}
                      color="gradient"
                      auto
                    />
                  </Link>
                </Tooltip>
              </Grid>
            </Grid.Container>
          </Card.Footer>
        </Card>
      </Grid>
      <Grid xs={12} sm={6}>
        <div>
          <Text h2>💫 About Me:</Text>
          <Text>
            🔭 I’m currently working on <strong>TenEleven</strong>
            <br />
            🌱 I’m currently learning <strong>Three.js</strong>,{' '}
            <strong>AWS</strong>
            <br />
            🏆 I’m currently working with <strong>TypeScript</strong>,{' '}
            <strong>React</strong>
            <br />
            🏆 I’m interesed in <strong>WTF</strong> (When To Fetch)
          </Text>
          <Spacer y={1} />
          <Text h2>📊 GitHub Stats:</Text>
          <Image
            src="https://github-readme-stats.vercel.app/api?username=jglee96&theme=react&hide_border=false&include_all_commits=false&count_private=true"
            width={'100%'}
            aria-label="github status"
          />
        </div>
      </Grid>
    </Grid.Container>
  );
}

export default Index;
