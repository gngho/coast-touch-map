# Coast — 차량 AI 상호작용 실험

iPad 참가자용 내비게이션 자극과 PC 진행자용 관리자 화면을 포함한 연구용 웹앱입니다. 현재 화면·서버 버전은 **2.9.1**입니다. package.json의 2.0.0은 초기 패키지 버전입니다.

## 포함된 기능

- 참가자 `/`: 실제 해안 지도, 터치 이동·확대, 고정 경로·방향 화살표, AI 상태별 애니메이션.
- 진행자 `/admin`: 연결 코드, 8조건 선택, 시행 준비·시작·종료·중단, Cue·화면 상태 제어.
- PC 로컬 음원 재생 및 참가자 터치/진행자 확인에 따른 후속 재생.
- Williams 라틴스퀘어 8조건 묶음 × 2시나리오 배정: 장소(식당·카페) 1회 + 정보(날씨·도로) 1회 후 묶음 설문 완료 확인. 이전 배정표는 원래 방식으로 보존.
- 시행·이벤트 저장, 한국어 로그 요약, CSV·JSON 내보내기, 확인 후 기록 초기화.
- Sites Worker API, D1 스키마·마이그레이션, 로컬 SQLite 서버, 회귀 테스트.

실제 AI, 음성 인식·녹음, GPS 추적, Slow Roads 연동은 없습니다. Slow Roads는 별도로 TV에 표시하며 지도 경로와 화살표는 고정된 시각 자극입니다.

## 현재 운영 사이트

- [참가자 화면 · iPad](https://coast-touch-map.rudgh0862.workers.dev/)
- [관리자 화면 · PC](https://coast-touch-map.rudgh0862.workers.dev/admin)

두 기기 모두 위 Cloudflare 주소를 사용하고 허용된 계정으로 로그인합니다. 현재 관리자 버전은 **2.9.1**입니다. GitHub `main`에 반영한 변경은 Cloudflare Workers Builds를 통해 자동 배포됩니다.

이전 `chatgpt.site` 주소는 별도 배포본이며 현재 변경이 반영되지 않습니다. 기존 즐겨찾기는 위 주소로 교체하세요.

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

아이콘은 모든 조건에서 상시 표시하며 숨김 상태는 없습니다. Cue만 Twinkle 도움 제안 상태를 사용합니다. 초반 대화는 PC 재생 시작 시점에 맞춰 Listening 전환을 요청하며, Thinking 대기는 기본 0.5초입니다. 상태별 로그 업로드를 기다리며 대기 시간을 늘리지 않습니다. 소리는 PC에서 나므로 OS 출력 장치를 TV/HDMI로 지정합니다. 음원은 업로드되지 않으며 새로고침이나 조건 변경 시 다시 선택해야 합니다.

모든 AI 발화 직전에 공통 0.5초 띠링 알림음을 PC에서 자동 재생한 뒤 0.18초 쉬고 발화합니다. 2.7.2에서는 이전 알림음보다 진폭을 약 3dB 높이고 잔향 감쇠를 늘렸습니다. Suggestion은 제안과 최종 답변 앞에 각각 한 번, 나머지 조건은 최종 답변 앞에 한 번입니다. Thinking 대기 후 Speaking 전환을 요청하고 알림음→짧은 간격→음성 순서로 재생합니다. 동승자 대화에는 알림음을 붙이지 않습니다.

아이콘은 기본 144px로 확대하고 상태 이름을 표시합니다. Reactive·Cue의 답변은 현재 시행·재생 실행·아이콘에 연결된 참가자 터치 기록이 있어야 시작합니다. Reactive는 터치 후 진행자의 발화 완료 확인도 필요합니다.

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

Cloudflare 이전 및 자동 배포 설정은 [CLOUDFLARE.md](CLOUDFLARE.md)를 따릅니다. 현재 이 저장소는 Cloudflare Workers Builds에 연결되어 `main` push에 따른 자동 배포가 활성화되어 있습니다.


`npm run build`는 Cloudflare Worker를 `dist/cloudflare`에 검증 빌드합니다. 기존 Sites 번들은 `npm run build:sites`로 생성합니다. `.openai/hosting.json`은 이전 Site의 연결 정보입니다. 기존 Sites에는 GitHub push만으로 배포되지 않습니다. 현재 운영 중인 Cloudflare 사이트에 `main` push로 자동 배포합니다.
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

## 2.9.1 배정표 수동 선택

새 배정은 친구(FR)·직장 관계(BU) × RA/PC/PS/PD의 8조건입니다. 참가자당 16시나리오·8회 묶음 설문, 식당·카페·날씨·도로 각 4회입니다. 식별자는 `FR-restaurant`, `BU-weather`처럼 관계-시나리오만 포함합니다.

각 행의 선택 준비/재시행 준비로 순서를 직접 선택할 수 있습니다. 현재 시행을 종료·중단하고 연결을 복구한 뒤 준비하세요. 이전 시행은 보존하고 새 시행 번호 및 수동 선택 사유를 기록합니다. 자동 진행은 첫 미완료 묶음부터 이어지며 완료된 설문은 다시 요구하지 않습니다. 재시행이 기존 기록의 무효화나 설문 재수집을 뜻하지는 않습니다. 기존 12조건 배정표를 새 설계로 바꾸려면 새 배정표를 저장하세요. 기본 인원 16은 균형 주기 예시입니다.

## 2.9.1 네 점 AI와 이동 경로

참가자와 관리자는 `dot-ai.js/css`를 공유한다. Idle 네 점 정지, Listening 순차 바운스, Thinking 시계방향 회전, Speaking 두꺼운 막대 높이 변화. Twinkle은 같은 회전과 AI 패널 테두리 발광, “원하는 정보를 드릴 수 있어요!” 말풍선이다. WebGL 구체는 이전 시안에만 보존한다.

지도에는 저장된 약 9.5km 경로 전체를 표시하며 화살표는 기존 출발점에서 북쪽으로 초당 6m 이동한다. 끝에서는 정지하고, 초기화 및 새 시행 준비 시 같은 위치로 복귀한다. 숨겨진 탭이나 동작 줄이기 설정에서는 이동을 멈춘다. Speaking은 음성 진폭 분석이 아닌 상태 기반 애니메이션이다.
