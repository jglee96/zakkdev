'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@zakkdev/ui';
import { useEffect, useState } from 'react';
import BlogUpload from './components/BlogUpload';

export default function Manage() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [authCheck, setAuthCheck] = useState<boolean>(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      if (data.session == null) {
        setAuthCheck(false);
        router.push('/');
      } else {
        setAuthCheck(true);
      }
    });
  });

  if (authCheck === false) {
    return <>Auth Check...</>;
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  return (
    <div className="flex flex-wrap justify-center gap-x-10 gap-y-10">
      <Card className="w-96">
        <CardHeader>
          <CardTitle>계정</CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={handleSignOut}>로그아웃</Button>
        </CardContent>
      </Card>
      <BlogUpload />
    </div>
  );
}
