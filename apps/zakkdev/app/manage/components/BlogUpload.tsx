import { Card, CardHeader, CardTitle, CardContent, Button } from '@zakkdev/ui';

export default function BlogUpload() {
  return (
    <Card className="w-96">
      <CardHeader>
        <CardTitle>BLOG 게시물 업로드</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            console.log(e);
          }}
        >
          <div className="flex flex-col">
            <input className="block" type="file" />
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
