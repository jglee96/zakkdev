import fs from "fs";
import path from "path";
import matter from "gray-matter";
import OpenAI from "openai";
import { config } from "dotenv";

// .env.local 파일 로드 (없으면 .env 파일 시도)
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  config({ path: envPath });
} else {
  // .env.local이 없으면 .env 파일 시도
  config();
}

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 콘텐츠 디렉토리 경로
const CONTENT_DIR = path.join(process.cwd(), "content");

// 마크다운 파일 목록 가져오기
function getMarkdownFiles(dir: string): string[] {
  return fs
    .readdirSync(dir)
    .filter(
      (file) => path.extname(file) === ".mdx" || path.extname(file) === ".md"
    )
    .map((file) => path.join(dir, file));
}

// 본문에서 마크다운 문법 제거 (간단한 버전)
function stripMarkdown(content: string): string {
  return content
    .replace(/^#+\s+/gm, "") // 헤더 제거
    .replace(/\*\*(.*?)\*\*/g, "$1") // 볼드 제거
    .replace(/\*(.*?)\*/g, "$1") // 이탤릭 제거
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1") // 링크 제거
    .replace(/```[\s\S]*?```/g, "") // 코드 블록 제거
    .replace(/`([^`]+)`/g, "$1") // 인라인 코드 제거
    .replace(/^\s*[-*+]\s+/gm, "") // 리스트 마커 제거
    .replace(/^\s*\d+\.\s+/gm, "") // 번호 리스트 제거
    .replace(/\n{3,}/g, "\n\n") // 여러 줄바꿈을 2개로
    .trim();
}

// OpenAI로 한줄 요약 생성
async function generateSummary(
  content: string,
  model: string = "gpt-3.5-turbo"
): Promise<string> {
  const strippedContent = stripMarkdown(content);

  // 콘텐츠가 너무 길면 앞부분만 사용 (토큰 제한 고려, 비용 절감)
  // gpt-3.5-turbo는 더 저렴하므로 길이를 더 줄여도 됨
  const maxLength = model.includes("gpt-3.5") ? 2000 : 3000;
  const contentToSummarize =
    strippedContent.length > maxLength
      ? strippedContent.substring(0, maxLength) + "..."
      : strippedContent;

  try {
    const response = await openai.chat.completions.create({
      model: model,
      messages: [
        {
          role: "system",
          content:
            "당신은 블로그 포스트를 한줄로 요약하는 전문가입니다. 주어진 블로그 포스트의 핵심 내용을 한 문장으로 간결하고 명확하게 요약해주세요. 요약은 100자 이내로 작성해주세요.",
        },
        {
          role: "user",
          content: `다음 블로그 포스트를 한줄로 요약해주세요:\n\n${contentToSummarize}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 100, // 출력 토큰 줄여서 비용 절감
    });

    const summary = response.choices[0]?.message?.content?.trim() || "";
    return summary;
  } catch (error) {
    console.error("OpenAI API 오류:", error);
    throw error;
  }
}

// 파일에 summary 추가
async function addSummaryToFile(
  filePath: string,
  forceUpdate: boolean = false,
  model: string = "gpt-3.5-turbo"
) {
  try {
    const fileContent = fs.readFileSync(filePath, "utf-8");
    const { data, content } = matter(fileContent);

    // 이미 summary가 있고 forceUpdate가 false면 건너뛰기
    if (data.summary && !forceUpdate) {
      console.log(`⏭️  건너뜀 (이미 summary 존재): ${path.basename(filePath)}`);
      return;
    }

    console.log(`📝 요약 생성 중: ${path.basename(filePath)}`);

    // 요약 생성
    const summary = await generateSummary(content, model);

    // front matter에 summary 추가
    const updatedData = {
      ...data,
      summary,
    };

    // gray-matter를 사용해서 front matter 재생성
    const updatedContent = matter.stringify(content, updatedData);

    // 파일에 저장
    fs.writeFileSync(filePath, updatedContent, "utf-8");

    console.log(`✅ 완료: ${path.basename(filePath)}`);
    console.log(`   요약: ${summary}\n`);

    // API 호출 간 딜레이 (rate limit 방지)
    await new Promise((resolve) => setTimeout(resolve, 1000));
  } catch (error) {
    console.error(`❌ 오류 발생 (${path.basename(filePath)}):`, error);
  }
}

// 메인 함수
async function main() {
  // OPENAI_API_KEY 환경 변수 확인
  if (!process.env.OPENAI_API_KEY) {
    console.error("❌ OPENAI_API_KEY 환경 변수가 설정되지 않았습니다.");
    console.error(
      "   .env 파일에 OPENAI_API_KEY=your_api_key 형식으로 추가해주세요."
    );
    process.exit(1);
  }

  const files = getMarkdownFiles(CONTENT_DIR);
  const forceUpdate = process.argv.includes("--force");

  // 모델 선택 (기본값: gpt-3.5-turbo, --model 옵션으로 변경 가능)
  let model = "gpt-3.5-turbo"; // 기본값: 가장 저렴한 모델
  const modelIndex = process.argv.indexOf("--model");
  if (modelIndex !== -1 && process.argv[modelIndex + 1]) {
    model = process.argv[modelIndex + 1];
  }

  console.log(`📚 총 ${files.length}개의 파일을 처리합니다.`);
  console.log(`🤖 사용 모델: ${model}`);
  console.log(
    `💰 예상 비용: 약 $0.001 ~ $0.002 per 파일 (gpt-3.5-turbo 기준)\n`
  );

  for (const file of files) {
    await addSummaryToFile(file, forceUpdate, model);
  }

  console.log("✨ 모든 작업이 완료되었습니다!");
}

// 스크립트 실행
main().catch(console.error);
