'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import { Button } from '@zakkdev/ui';
import { useEffect } from 'react';

export default function Manage() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      if (data.session == null) router.push('/');
    });
  });

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  return (
    <>
      <Button onClick={handleSignOut}>Sign out</Button>
    </>
  );
}
