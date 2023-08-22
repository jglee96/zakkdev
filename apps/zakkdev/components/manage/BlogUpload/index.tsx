import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Card, CardHeader, CardTitle, CardContent, Button } from '@zakkdev/ui';
import { FormEvent, useState } from 'react';

export default function BlogUpload() {
  const [files, setFiles] = useState<File[]>([]);

  const supabase = createClientComponentClient();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const uploadPromise = files.map(async (file) => {
      return await supabase.storage
        .from('articles')
        .upload(`posts/${file.name}`, file, {
          cacheControl: '3600',
          upsert: false,
        });
    });

    await Promise.all(uploadPromise);
  };
  return (
    <Card className="w-96">
      <CardHeader>
        <CardTitle>BLOG 게시물 업로드</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col">
            <input
              className="block"
              type="file"
              onChange={(e) => {
                const list = e.target.files;
                if (list === null) return;

                setFiles([...files, ...list]);
              }}
            />
            {files.map((file) => file.name)}
            <Button
              className="flex break-keep w-fit"
              type="submit"
              size="default"
            >
              업로드
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
