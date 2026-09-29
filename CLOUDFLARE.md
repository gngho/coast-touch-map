# Cloudflare 이전 및 자동 배포

## 배포 구조

`GitHub main push → Cloudflare Workers Builds → npm test → Worker 번들 검증 → D1 migration → Worker + 정적 파일 배포`

- Worker: `server/cloudflare-worker.mjs`, 정적 파일: `public/`, DB: D1 `DB` binding.
- `/`는 참가자, `/admin`은 진행자 화면이다. 기존 실험 API·상태 전이·PC 음원 재생·기록 형식은 유지한다.
- 모든 경로는 Cloudflare Access 로그인 뒤 접근한다. 서버는 JWT 서명·issuer·audience·만료·허용 이메일을 검증한다. PC와 iPad는 같은 이메일로 로그인한다.
- 인증 설정이 빠지면 503, 유효한 인증이 없으면 401로 차단한다. 기존 Sites 인증 헤더를 외부에서 보내도 사용할 수 없다.
- `npm run build`는 업로드 없는 Cloudflare 번들 검증이다. 기존 Sites 빌드는 `npm run build:sites`로 보존한다.

## 최초 1회 계정 연결

1. Cloudflare 계정에서 Workers & Pages에 `coast-touch-map` Worker를 만든다. 별도 도메인이 없으면 할당된 `coast-touch-map.<계정 subdomain>.workers.dev`를 사용한다.
2. Workers 설정의 workers.dev 주소에서 Cloudflare Access 보호를 활성화한다. Zero Trust의 해당 애플리케이션 정책은 **Allow → Emails → rudgh0862@gmail.com**으로 제한한다. 경로는 `/admin`만이 아니라 호스트 전체를 보호한다. One-time PIN 또는 연결된 로그인 제공자를 사용한다.
3. Access의 team domain(`https://<team>.cloudflareaccess.com`)과 해당 애플리케이션의 AUD를 확인한다.
4. D1 데이터베이스 `coast-touch-map`을 생성한다. CLI 사용 시 `npx wrangler login`, `npx wrangler d1 create coast-touch-map`을 실행한다.
5. `wrangler.json`에 D1 `database_id`, `vars.ACCESS_TEAM_DOMAIN`, `vars.ACCESS_AUD`를 입력한다. 이 값들은 비밀키가 아니다. `ACCESS_ALLOWED_EMAIL`은 제공된 이메일로 설정되어 있다. API 토큰은 이 파일에 넣지 않는다.
6. `npm run cf:check`로 설정을 검증하고 변경사항을 GitHub main에 반영한다.
7. Worker → Settings → Builds → Connect에서 GitHub `gngho/coast-touch-map`을 연결한다. 설정은 아래와 같다.

| 설정 | 값 |
|---|---|
| Worker name | `coast-touch-map` |
| Production branch | `main` |
| Root directory | 저장소 루트 |
| Build command | `npm run cf:check` |
| Deploy command | `npm run deploy` |
| Node version | `24` (`NODE_VERSION=24` 빌드 변수 또는 `.node-version`) |
| 비운영 브랜치 자동 배포 | 끔; 운영 D1 공유 방지 |

Builds의 배포 토큰에는 Workers 배포와 D1 마이그레이션에 필요한 권한이 있어야 한다. D1 수정 권한이 없으면 마이그레이션 단계에서 배포가 중단된다. 테스트나 번들 검증 실패 시에도 배포하지 않는다. GitHub Actions는 PR·main 검증용이며, 실제 자동 배포는 Cloudflare Git 연결에서 수행한다.

환경변수로 설정 파일을 작성하려면 `COAST_D1_DATABASE_ID`, `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`를 지정한 뒤 `npm run cf:configure`를 실행한다. 기본 placeholder 상태는 실제 배포를 허용하지 않는다.

## 데이터와 전환

- Git 저장소에는 기존 Sites의 운영 DB가 없다. 새 D1은 새 기록 저장소로 시작한다. 기존 기록은 기존 관리자 페이지에서 전체 JSON/CSV로 내려받아 보관한다.
- 기존 DB를 자동 복사하거나 기존 사이트를 삭제하지 않는다. 과거 기록을 새 DB에서 이어 사용하려면 별도 데이터 이관과 owner 매핑 검증이 필요하다. `oai` 사용자 ID와 Cloudflare `sub`는 다르다.
- 브라우저 저장소도 도메인별로 분리된다. 새 주소에서 연결 코드를 생성해 PC–iPad를 새로 연결하고, PC 음원을 다시 선택한다. 기존 미전송 로그는 기존 도메인에서 전송 완료시킨다.
- `chatgpt.site` 주소를 Cloudflare 주소로 직접 옮기는 것은 이 저장소 배포에 포함되지 않는다. 새 workers.dev 또는 소유한 도메인으로 접속한다.
- 실험 중 배포하면 이미 열린 탭에 이전 코드가 남을 수 있다. 변경사항은 시행 사이에 push하고, 배포 후 두 화면을 새로고침한다.
- 자동 DB migration은 미적용 SQL만 실행한다. 이후 migration은 이전 Worker와도 호환되게 작성한다. Worker 롤백은 D1 데이터·스키마를 되돌리지 않는다.

## 검증

```sh
npm ci
npm test
npm run build
npm run db:migrate:local
```

실서비스 전환 후 두 기기 로그인 → 연결 → 조건 준비 → 시행 시작 → Cue 터치/음원 → 종료 → 로그 내보내기를 확인한다. 원격 D1, 실제 iPad Safari, TV 음향과 네트워크 지연 검증은 로컬 자동 테스트와 별개이다.

## 공식 문서

- https://developers.cloudflare.com/workers/ci-cd/builds/
- https://developers.cloudflare.com/workers/static-assets/binding/
- https://developers.cloudflare.com/d1/reference/migrations/
- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
