import { Button } from '@zakkdev/ui';
import Link from 'next/link';

const Footer = () => {
  return (
    <>
      <Button>
        <Link href="https://github.com/jglee96" />
      </Button>
      <Button>
        <Link href="https://jglee96.tistory.com/" />
      </Button>
      <Button>
        <Link href="https://codepen.io/jglee96" />
      </Button>
    </>
  );
};

export default Footer;
