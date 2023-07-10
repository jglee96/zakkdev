import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Button,
} from '@zakkdev/ui';
import { GitHubLogoIcon, CubeIcon, RocketIcon } from '@radix-ui/react-icons';
import Image from 'next/image';
import Link from 'next/link';

export function Index() {
  return (
    <div className="flex flex-wrap justify-center gap-6 align-middle">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle className="m-0">Zakklee</CardTitle>
          <CardDescription>jglee96</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Image
            width={500}
            height={400}
            className="rounded-xl"
            src="/canada.webp"
            alt="profile image"
          />
        </CardContent>
        <CardFooter className="float-right">
          <Button variant="ghost" size="icon" asChild>
            <Link href="https://github.com/jglee96">
              <GitHubLogoIcon />
            </Link>
          </Button>
          <Button variant="ghost" size="icon" asChild>
            <Link href="https://jglee96.tistory.com/">
              <RocketIcon />
            </Link>
          </Button>
          <Button variant="ghost" size="icon" asChild>
            <Link href="https://codepen.io/jglee96">
              <CubeIcon />
            </Link>
          </Button>
        </CardFooter>
      </Card>
      <div>
        <h2 className="text-3xl mb-2">💫 About Me:</h2>
        <p>
          🔭 I’m currently working on <strong>TenEleven</strong>
          <br />
          🌱 I’m currently learning <strong>Three.js</strong>,{' '}
          <strong>AWS</strong>
          <br />
          🏆 I’m currently working with <strong>TypeScript</strong>,{' '}
          <strong>React</strong>
          <br />
          🏆 I’m interesed in <strong>WTF</strong> (When To Fetch)
        </p>
        <h2 className="text-3xl mb-2">📊 GitHub Stats:</h2>
        <Image
          width={500}
          height={400}
          src="https://github-readme-stats.vercel.app/api?username=jglee96&theme=react&hide_border=false&include_all_commits=false&count_private=true"
          aria-label="github status"
          alt="github status"
        />
      </div>
    </div>
  );
}

export default Index;
