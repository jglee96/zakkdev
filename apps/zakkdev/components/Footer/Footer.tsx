import { Button } from '@zakkdev/ui';
import { GitHubLogoIcon, CubeIcon, RocketIcon } from '@radix-ui/react-icons';
import Link from 'next/link';

const Footer = () => {
  return (
    <>
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
    </>
  );
};

export default Footer;
