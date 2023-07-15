'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Button } from '@zakkdev/ui';
import { useRouter } from 'next/navigation';

export default function Login() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  const handleSignIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${location.origin}/auth/callback`,
      },
    });
    router.refresh();
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.refresh();
  };

  return (
    <>
      <Button onClick={handleSignIn}>Sign in</Button>
      <Button onClick={handleSignOut}>Sign out</Button>
    </>
  );
}
