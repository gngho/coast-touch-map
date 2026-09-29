# Coast — 차량 AI 상호작용 실험

iPad 참가자용 내비게이션 자극과 PC 진행자용 관리자 화면을 포함한 연구용 웹앱입니다. 현재 화면·서버 버전은 **2.4.0**입니다. package.json의 2.0.0은 초기 패키지 버전입니다.

## 포함된 기능

- 참가자 `/`: 실제 해안 지도, 터치 이동·확대, 고정 경로·방향 화살표, AI 상태별 애니메이션.
- 진행자 `/admin`: 연결 코드, 12조건 선택, 시행 준비·시작·종료·중단, Cue·화면 상태 제어.
- PC 로컬 음원 재생 및 참가자 터치/진행자 확인에 따른 후속 재생.
- Williams 라틴스퀘어 조건 순서와 식당·박물관 사례 배정.
- 시행·이벤트 저장, 한국어 로그 요약, CSV·JSON 내보내기, 확인 후 기록 초기화.
- Sites Worker API, D1 스키마·마이그레이션, 로컬 SQLite 서버, 회귀 테스트.

실제 AI, 음성 인식·녹음, GPS 추적, Slow Roads 연동은 없습니다. Slow Roads는 별도로 TV에 표시하며 지도 경로와 화살표는 고정된 시각 자극입니다.

## 다른 PC에서 실행

Node.js **24 이상**, npm, Git이 필요합니다. 저장소를 복제한 폴더에서 실행합니다.

```sh
npm ci
npm test
npm run build
npm start
```

- 참가자: http://127.0.0.1:4173/
- 진행자: http://127.0.0.1:4173/admin
- 종료: 실행한 터미널에서 Ctrl+C.

로컬 서버는 `127.0.0.1`에만 바인딩하며 한 PC의 두 브라우저 탭으로 기능을 확인하는 용도입니다. iPad에서는 이 주소에 접속할 수 없습니다. 로컬 API는 테스트 소유자 계정을 사용하므로 외부 공개 서버로 실행하지 마세요. 개발 DB는 `.sites-runtime/coast.sqlite`에 생성되며 Git에서 제외됩니다.

기존 운영 주소는 아래와 같습니다. Cloudflare 전환을 마치면 새 workers.dev 주소의 `/`와 `/admin`을 사용합니다.

- 참가자: https://coast-touch-map.rudgh0862.chatgpt.site/
- 진행자: https://coast-touch-map.rudgh0862.chatgpt.site/admin

## 실험 진행

1. 관리자에서 연결 코드를 생성하고 iPad 준비 모드 설정에서 입력합니다.
2. 익명 참가자 ID, 관계, 개입 방식, 시나리오를 선택하거나 저장한 배정표에서 불러옵니다.
3. 시행 준비 후 iPad 적용 확인을 기다리고 시행 시작을 누릅니다.
4. PC에서 대화·최종 답변 음원을 선택합니다. Suggestion에는 제안 음원도 필요합니다.
5. **동승자 대화 재생 · 자동 진행**을 클릭합니다. Space는 초기 재생이 아닌 응답 대기 중 확인 키입니다.
6. 답변 재생 후 진행자가 시행 종료 또는 중단을 선택합니다. 로그 저장 대기가 0건인지 확인합니다.

| 조건 | Idle 준비 상태 이후 |
|---|---|
| Reactive | Idle 대화 → 아이콘 터치 → Listening 요청 발화 → 진행자 확인 → Thinking → Speaking 답변 → Idle |
| Cue | Listening 대화 → Twinkle → 아이콘 터치 → Thinking → Speaking 답변 → Idle |
| Suggestion | Listening 대화 → Thinking → Speaking 제안 → Listening 응답 → 진행자 확인 → Thinking → Speaking 답변 → Idle |
| Direct | Listening 대화 → Thinking → Speaking 답변 → Idle |

아이콘은 모든 조건에서 상시 표시하며 숨김 상태는 없습니다. Cue만 Twinkle 도움 제안 상태를 사용합니다. 화면 적용 확인 후 해당 음원을 시작하며, Thinking 대기는 기본 1초입니다. 소리는 PC에서 나므로 OS 출력 장치를 TV/HDMI로 지정합니다. 음원은 업로드되지 않으며 새로고침이나 조건 변경 시 다시 선택해야 합니다.

## 코드 구조

| 경로 | 역할 |
|---|---|
| `public/index.html`, `app.*`, `map.js`, `route*.js` | 참가자 지도·자극 |
| `public/ai.*`, `experiment.js`, `sync.js`, `connection.js` | AI 상태, 참가자 조작, 동기화 |
| `public/admin/` | 관리자, 오디오 진행, 배정표, 로그 요약 |
| `server/api.mjs`, `server/domain.mjs` | 인증·세션·시행 API와 상태 전이 |
| `server/cloudflare-worker.mjs`, `server/access.mjs` | Cloudflare Worker 진입점·Access 인증 |
| `server/worker.mjs` | 기존 Sites Worker 진입점 |
| `server.mjs`, `server/dev-db.mjs` | 로컬 개발 서버·SQLite |
| `db/`, `drizzle/` | 스키마·마이그레이션 |
| `public/vendor/`, `styles/`, `icons/` | 번들 지도 라이브러리·스타일·아이콘 |
| `tests/` | 조건·오디오·연결·배정·로그 회귀 테스트 |

## 배포·데이터·측정 범위

Cloudflare 이전 및 자동 배포 설정은 [CLOUDFLARE.md](CLOUDFLARE.md)를 따릅니다. `main` push에 따른 자동 배포는 Cloudflare Workers Builds에 이 저장소를 연결한 뒤 활성화됩니다.


`npm run build`는 Cloudflare Worker를 `dist/cloudflare`에 검증 빌드합니다. 기존 Sites 번들은 `npm run build:sites`로 생성합니다. `.openai/hosting.json`은 기존 Site의 연결 정보입니다. 해당 Site 권한이 있는 환경에서 Sites 도구로 배포합니다. 기존 Sites에는 GitHub push만으로 배포되지 않습니다. 새 Cloudflare 사이트는 최초 계정·DB·Access·Git 연결 완료 후 `main` push로 자동 배포합니다.
GitHub Actions는 테스트와 두 플랫폼의 빌드 아티팩트를 검증·보관합니다. [CI·배포 안내](docs/CI-AND-DEPLOYMENT.md)를 참고하세요.


운영 DB, 로컬 DB, 참가자 로그 내보내기, 선택한 음원, 로그인 정보는 저장소에 포함하지 않습니다. 음원은 별도로 준비합니다. 스키마 변경은 `npm run db:generate`로 새 마이그레이션을 생성하며 이미 배포된 마이그레이션은 수정하지 않습니다.

Cue 반응시간은 같은 iPad의 표시 적용 기록 → 첫 터치입니다. 진행자 확인 간격은 참가자의 순수 발화 반응시간이 아니며 브라우저 재생 이벤트는 물리적 TV 음향 시작 시각이 아닙니다. 실제 iPad Safari·TV·장시간 실험은 현장 파일럿이 필요합니다.

- [운영 안내](OPERATING.md)
- [검증 기록](VALIDATION.md)
- [CLI 인수인계](HANDOFF.md)
- [이전 단계 제작 기록](docs/README-history.md) — 과거 버전 설명은 현재 동작과 다를 수 있습니다.

## 출처

- Pleos 배치 참고: https://document.pleos.ai/docs/connect/guide/docs-design/getting-started/layout
- MapLibre: `public/vendor/MAPLIBRE-LICENSE.txt`
- OpenFreeMap / OpenMapTiles / OpenStreetMap: https://openfreemap.org/
- Positron: `public/styles/STYLE-LICENSE.md`, `public/styles/POSITRON-LICENSE.md`

현대자동차 또는 Slow Roads의 공식 제품이 아닌 독립 연구용 프로토타입입니다.
