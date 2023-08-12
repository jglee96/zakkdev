'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@zakkdev/ui';
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
    <div className="flex flex-wrap justify-center gap-x-10 gap-y-10">
      <Card className="w-96">
        <CardHeader>
          <CardTitle>계정</CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={handleSignOut}>Sign out</Button>
        </CardContent>
      </Card>
      <Card className="w-96">
        <CardHeader>
          <CardTitle>BLOG 게시물 업로드</CardTitle>
        </CardHeader>
        <CardContent>
          <form>
            <div className="flex flex-row">
              <input className="block" type="file" />
              <Button className="flex break-keep" type="submit">
                업로드
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
