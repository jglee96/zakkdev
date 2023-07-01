'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Button,
} from '@zakkdev/ui';
import Image from 'next/image';
import Link from 'next/link';

export function Index() {
  return (
    <>
      <div>
        <Card>
          <CardHeader>
            <CardTitle>Zakklee</CardTitle>
            <CardDescription>jglee96</CardDescription>
          </CardHeader>
          <CardContent>
            <Image
              width={500}
              height={400}
              src="/canada.webp"
              alt="profile image"
            />
          </CardContent>
          <CardFooter>
            <Button>
              <Link href="https://github.com/jglee96" />
            </Button>
            <Button>
              <Link href="https://jglee96.tistory.com/" />
            </Button>
            <Button>
              <Link href="https://codepen.io/jglee96" />
            </Button>
          </CardFooter>
        </Card>
      </div>
      <div>
        <div>
          <h2>💫 About Me:</h2>
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
          <h2>📊 GitHub Stats:</h2>
          <Image
            width={500}
            height={400}
            src="https://github-readme-stats.vercel.app/api?username=jglee96&theme=react&hide_border=false&include_all_commits=false&count_private=true"
            aria-label="github status"
            alt="github status"
          />
        </div>
      </div>
    </>
  );
}

export default Index;
