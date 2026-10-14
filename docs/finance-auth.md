# 개인 금융 공간 인증

개인 소유자용 비밀번호 로그인과 8시간 서명 세션을 제공한다. `/finance/login`을 제외한 금융 화면은 로그인으로 보호한다. 로그인 API 외 모든 금융 API는 유효한 세션을 요구한다. 기존 블로그와 `/ai`는 공개 상태를 유지한다. 금융 Bot/분석/예약 실행은 후속 작업이며 이 변경에 포함되지 않는다.

## 비밀번호와 세션 키

비밀번호를 코드나 명령 인수에 넣지 않는다. 로그인 서버에는 Argon2id 해시만 저장한다. 아래 명령은 비밀번호를 표시하지 않고 읽으며, 해시와 세션 키를 **새 파일**에만 저장한다. 기존 파일은 덮어쓰지 않는다. 생성된 파일은 0600 권한이며 credential 값을 stdout에 출력하지 않는다.

```bash
IFS= read -rs -p '새 비밀번호(16자 이상): ' finance_password
printf '\n'
printf '%s' "$finance_password" | pnpm finance:credentials .env.finance.local
unset finance_password
```

`.env.finance.local`은 Git에서 제외되지만 Next.js가 자동으로 읽는 파일은 아니다. 로컬 개발 시 생성된 두 항목을 `.env.local`에 안전한 편집기로 옮긴다. 기존 설정을 덮어쓰지 않는다. Next.js의 환경변수 확장 때문에 로컬 파일의 해시에는 생성기가 넣은 `\$` 이스케이프를 유지한다. Vercel 환경변수 UI에는 로컬 파일의 따옴표와 이스케이프를 제외한 원래 PHC 해시 값을 입력한다. 비밀번호 원문·해시·서명 키를 채팅, Git, 로그, 클라이언트 코드에 복사하지 않는다.

| 변수 | 설정 |
|---|---|
| `FINANCE_PASSWORD_HASH` | Argon2id PHC 해시. 생성기는 m=19456 KiB, t=2, p=1 사용 |
| `FINANCE_SESSION_SECRET` | 생성기가 만든 최소 32바이트 base64url 난수 |
| `FINANCE_APP_ORIGIN` | 정확한 앱 Origin. 경로/마지막 슬래시 없음. 배포는 HTTPS |
| `FINANCE_AUTH_TABLE` | 아래 CDK가 생성한 DynamoDB 테이블 이름 |
| `AWS_REGION` | 테이블의 리전. 기본 인프라 리전은 ap-northeast-2 |
| `FINANCE_DYNAMODB_ENDPOINT` | localhost 개발에만 사용. 배포에서는 반드시 제거 |

`NEXT_PUBLIC_` 접두사를 붙이지 않는다. Production과 Preview는 비밀 값을 분리하고 각각의 Origin을 설정한다. 단일 Origin만 허용하므로 해당 배포에서 사용할 정확한 URL을 지정한다. 새 Preview URL을 사용할 때도 별도 설정이 필요하다. 필수 값이 없거나 잘못되면 로그인/금융 접근이 닫힌다.

## DynamoDB와 AWS 권한

서버 메모리 기반 제한은 여러 Vercel 인스턴스에서 우회할 수 있어 사용하지 않는다. IP별 5회, 전체 30회의 로그인 시도를 15분 고정 구간마다 DynamoDB transaction으로 제한한다. 성공한 로그인도 한도를 소비한다. 구간 경계에서는 다음 구간의 한도가 열리며 TTL은 오래된 행 정리에만 사용한다. 제한은 429와 Retry-After, 저장소 장애/권한 오류는 503으로 반환한다.

```bash
# AWS 인증은 기존 프로파일 또는 임시 자격증명을 사용한다. 키를 저장소에 넣지 않는다.
pnpm infra:finance-auth synth
# 최초 계정/리전 CDK 사용 시 운영자가 bootstrap을 수행한다.
pnpm infra:finance-auth bootstrap
pnpm infra:finance-auth deploy -c runtimeRoleName=your-vercel-runtime-role
```

CDK는 on-demand, TTL, PITR, 삭제 시 보존하는 로그인 카운터 테이블을 만든다. runtimeRoleName을 지정하면 **그 테이블의 `dynamodb:UpdateItem`만** 허용하는 정책을 해당 기존 역할에 붙인다. TransactWriteItems의 각 Update 작업에 필요한 권한이다. 역할을 지정하지 않으면 테이블만 생성한다. 출력 AuthTableName을 FINANCE_AUTH_TABLE에 설정한다. 배포 전에 synth 결과와 AWS 비용을 확인한다. CDK destroy는 데이터 테이블을 보존하므로 최종 제거는 운영자가 별도로 수행한다.

Vercel에서는 표준 AWS credential provider가 읽을 수 있는 서버 전용 최소 권한 자격증명을 제공해야 한다. 이미 구성한 OIDC 기반 역할/임시 자격증명 경로가 있으면 재사용한다. **이 변경은 Vercel OIDC 신뢰 정책이나 credential exchange를 새로 구성하지 않는다.** `AWS_ROLE_ARN`만 설정해도 인증되는 것은 아니다. 별도 연결이 없다면 제한된 IAM 자격증명을 서버 환경변수로 관리·회전한다.

IP는 Vercel이 설정한 `x-vercel-forwarded-for`만 읽는다. 임의의 `X-Forwarded-For`로 제한을 우회할 수 없다. Vercel 외 production 배포는 지원하지 않으며 플랫폼/IP 어댑터를 추가하기 전까지 로그인은 닫힌다. localhost 개발은 모든 요청을 하나의 local identity로 제한한다.

## 로컬 실행과 검증

Node 24와 pnpm 10을 사용한다. Chromium은 브라우저 검증에 필요하다. 로컬 DynamoDB 이미지는 버전 3.3.0을 사용한다.

```bash
pnpm install --frozen-lockfile
docker run --rm --name zakkdev-finance-auth-ddb -p 127.0.0.1:8000:8000 \
  amazon/dynamodb-local:3.3.0 -jar DynamoDBLocal.jar -inMemory -sharedDb
```

별도 터미널에서 로컬 테이블을 만든다. 아래 인증 문자열은 로컬 에뮬레이터의 dummy 값이며 AWS 자격증명이 아니다.

```bash
AWS_ACCESS_KEY_ID=local AWS_SECRET_ACCESS_KEY=local aws dynamodb create-table \
  --endpoint-url http://127.0.0.1:8000 --region ap-northeast-2 \
  --table-name finance-auth-local --billing-mode PAY_PER_REQUEST \
  --attribute-definitions AttributeName=pk,AttributeType=S \
  --key-schema AttributeName=pk,KeyType=HASH
```

`.env.example`의 비밀이 아닌 설정과 생성한 비밀을 `.env.local`에 넣고 `pnpm dev`로 실행한다. 개발 URL은 FINANCE_APP_ORIGIN과 정확히 같아야 한다. localhost HTTP는 별도의 `finance-session-local` 쿠키를 사용한다. 배포는 `__Host-finance-session` + Secure/HttpOnly/SameSite=Strict/Path=/를 사용하고 Domain은 설정하지 않는다.

```bash
pnpm test:finance
# 실행 중인 로컬 DynamoDB 필요. 테스트별 테이블 생성/삭제.
pnpm test:finance:integration
# 로컬 DynamoDB + Chromium 필요. 임시 비밀/테이블/4201 포트 dev 서버를 자체 생성/정리.
pnpm test:finance:e2e
pnpm exec tsc --noEmit
pnpm lint
# build 전에 dev/E2E 서버를 중지해 .next 쓰기 충돌을 피한다.
pnpm build
```

## 세션과 보호 규칙

로그인/로그아웃 및 금융 POST/PATCH/DELETE는 설정한 Origin과 요청 Origin을 비교하며 누락/불일치를 거절한다. 리디렉션/middleware만으로 보호하지 않는다. 새 금융 Route Handler는 데이터 접근/Tool 실행 전 `requireFinanceSession(request)`를 호출하고 반환된 서버 ownerId를 사용해야 한다. 신규 금융 Server Component도 서버에서 세션을 확인한다. ownerId를 클라이언트/LLM의 인수에서 가져오지 않는다. 응답은 no-store이며 세션 토큰을 localStorage에 저장하지 않는다.

로그아웃은 브라우저 쿠키를 만료시킨다. Stateless 세션이므로 탈취된 쿠키의 개별 서버 폐기는 제공하지 않는다. 비밀번호 변경 시 FINANCE_PASSWORD_HASH와 FINANCE_SESSION_SECRET을 **함께 회전하고 재배포**하여 전체 세션을 무효화한다. 초기 세션은 8시간 후 만료되고 자동 연장하지 않는다. AWS 예약 Worker는 웹 쿠키와 별개로 IAM 및 DB 권한을 검증한다.

IP 신뢰 계약: [Vercel request headers](https://vercel.com/docs/headers/request-headers). Vercel 외부 프록시의 클라이언트 IP를 임의로 신뢰하는 설정은 추가하지 않는다.
