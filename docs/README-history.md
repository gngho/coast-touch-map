# Coast 2.1 — PC 음원 자동 진행

/admin에서 로컬 TTS 음원을 선택하여 재생합니다. Reactive·Suggestion은 진행자 Space/버튼, Cue는 iPad 첫 터치, Direct는 초반 대화 종료로 다음 단계에 진입합니다. 음원은 PC에서만 재생하고 서버에 업로드하지 않습니다. 마이크·음성 인식은 없습니다. Web Audio 시작 호출·종료 콜백 및 진행자 확인을 서버 이벤트로 기록하며 실제 발화/TV 소리 시점과 구분합니다.

현재 사용법은 OPERATING.md, 검증 범위는 VALIDATION.md를 참고하세요. 아래는 이전 제작 단계의 기록입니다.

# Coast · 캘리포니아 해안

## 2.0 연구 실험용 확장

현재 버전은 참가자용 `/`와 진행자용 `/admin`, Sites Worker API 및 D1 저장소를 포함합니다. 12조건 선택, 단일 iPad 연결, Cue 제시·터치, 수동 애니메이션 제어, 시행·이벤트 로그와 CSV/JSON 내보내기를 지원합니다. 음성은 별도 프로그램에서 진행자가 재생합니다. 상세 운영은 [OPERATING.md](OPERATING.md), 검증 범위는 [VALIDATION.md](VALIDATION.md)를 참고하세요.

로컬 개발은 Node.js 24 이상에서 `npm ci`, `node server.mjs`로 실행합니다. http://127.0.0.1:4173/admin 과 http://127.0.0.1:4173/ 을 사용합니다. 로컬 프리뷰는 loopback에만 바인딩하고 테스트 소유자 계정을 사용합니다. 운영 Worker에는 이 인증 우회가 포함되지 않습니다. 테스트 데이터는 무시된 `.sites-runtime/coast.sqlite`에만 저장되어 배포에 포함되지 않습니다.

`node --test tests/*.test.mjs`로 검증하고 `node build.mjs`로 Worker와 UI·마이그레이션을 생성합니다. 변경된 스키마는 `npm run db:generate`로 새 마이그레이션을 생성합니다. 이미 배포된 마이그레이션은 수정하지 않습니다. `.openai/hosting.json`의 기존 project_id와 비공개 접근 정책을 유지합니다.

아래는 1차 지도 제작 기록입니다.

iPad Air 11형(M3)을 위한 Pleos 스타일의 지도 중심 터치 화면입니다. 실제 캘리포니아 빅서 해안 지도를 표시합니다.

## 사용

배포 주소를 iPad Safari에서 열고 Sites 소유 계정으로 로그인합니다. 공유 메뉴의 **홈 화면에 추가**를 선택하고 **웹 앱으로 열기**가 보이면 켭니다. 홈 화면의 Coast 아이콘을 눌러 사용합니다. 가로 방향을 기본으로 설계했으며 세로 방향도 지원합니다.

- 한 손가락 드래그: 지도 이동
- 두 손가락 핀치 또는 +/−: 확대·축소
- 집 아이콘: 처음 좌표와 배율로 복귀
- 설정: 지명 표시, 지도 초기화, 출처 확인
- 지명 표시 선택만 기기에 저장하며 새로 열면 초기 위치로 돌아갑니다.

인터넷 연결이 필요합니다. 자동 이동, 위치 추적, 경로 탐색, 음성 안내, Slow Roads 연동은 포함하지 않습니다. 오프라인일 때는 연결 복구 후 **다시 시도**를 누릅니다.

## 로컬 실행

Node.js 22 이상에서 프로젝트 디렉터리로 이동하여 `npm start` 또는 `node server.mjs`를 실행하고 http://127.0.0.1:4173 을 엽니다. 로컬 실행에는 의존성 설치나 빌드가 필요하지 않습니다. 배포 파일은 `npm run build`로 dist/에 생성합니다. HTML 파일을 직접 여는 file:// 방식은 지원하지 않습니다.

## 구성

- public/index.html / app.css: 한국어 UI, 반응형 레이아웃, 터치 영역, 모달
- public/app.js: 화면 이벤트와 현지 시계
- public/map.js: 지도 생성 및 확대·복귀·지명 상태 반영
- public/state.js: 기기 내 지명 설정 저장
- public/styles/coast.json: 프로젝트에 저장된 Positron 기반 지도 스타일
- public/vendor/: MapLibre GL JS 5.21.0 번들과 CSS·라이선스
- public/icons/ 및 manifest.webmanifest: 홈 화면 아이콘과 standalone 설정

초기 중심은 [-121.901, 36.371], zoom 13, 범위 5–18입니다. 북쪽 위 2D로 고정합니다. 앱과 지도 라이브러리는 자체 배포 파일에 포함되며 타일·글리프·지도 심벌은 OpenFreeMap에서 요청합니다. 사용자 GPS와 센서는 사용하지 않습니다.

## 검증

Windows Edge에서 1180×820 및 820×1180 CSS px, 터치 에뮬레이션으로 다음을 검증했습니다: 실제 타일 로드, 확대·축소, 드래그, 초기 위치 복귀, 두 손가락 핀치, 북쪽·2D 고정, 모달 뒤 지도 조작 차단, 지명 저장, 재접속 초기 상태, 세로 배치, 출처 표시, 오프라인 및 스타일 로딩 실패 후 재시도. JavaScript 런타임 오류는 없었습니다.

실제 iPad Safari, 홈 화면 standalone 실행, 실제 기기 회전 및 장시간 성능은 아직 실기기에서 검증하지 않았습니다. 브라우저 에뮬레이션을 실기기 검증으로 간주하지 않습니다.

## 출처

- UI 참고: https://document.pleos.ai/docs/connect/guide/docs-design/getting-started/layout
- MapLibre GL JS 5.21.0: public/vendor/MAPLIBRE-LICENSE.txt
- OpenFreeMap / OpenMapTiles / OpenStreetMap: https://openfreemap.org/
- Positron 스타일: public/styles/STYLE-LICENSE.md 및 POSITRON-LICENSE.md. 색상과 영어 지명 표현을 수정했습니다.

현대자동차 및 Slow Roads의 공식 제품이 아닌 독립 프로젝트입니다.

## 1.1 업데이트

상단의 지역 제목을 제거했습니다. Cabrillo Highway 약 9.5km 구간의 실제 도로 형상을 따라 파란 경로선과 정지된 데모 차량 아이콘을 표시합니다. OSRM에서 얻은 OpenStreetMap 기반 경로를 public/route-data.js에 저장했으며 실행 중에는 경로 서비스에 요청하지 않습니다. 지명 설정은 경로와 차량 표시를 숨기지 않습니다. 실제 GPS나 게임 위치는 아닙니다.


## 경로 표시 수정

차량 아이콘을 북쪽 진행 방향의 화살표로 변경했습니다. 화살표 위치부터 북쪽으로 남은 경로만 강조하며 남쪽의 지나온 경로에는 파란색이나 흰색 경로선을 그리지 않습니다.

## AI 아이콘 움직임

지도 왼쪽 아래의 Gemini Astroid 아이콘을 누르면 상태 미리보기를 엽니다. Idle은 잔잔한 밝기와 크기 변화, Listening은 호흡과 퍼지는 링, Thinking은 일정한 회전과 밝기 변화, Speaking은 불규칙한 리듬의 크기 변화로 표현합니다. 선택한 상태는 페이지를 다시 열면 Idle로 돌아갑니다. 마이크·음성·AI 서비스와 연결되지 않은 시각적 데모입니다.

public/ai.js는 상태와 패널 조작을, public/ai.css는 애니메이션을 관리합니다. 기기의 동작 줄이기 설정에서는 움직임을 중지하고 상태 이름을 유지합니다. 내장 브라우저에서 네 상태 전환, 패널 닫기, 1280×720 및 820×1180 화면 배치와 터치 영역을 확인했습니다. 실제 iPad 검증은 하지 않았습니다.

iPad 터치 선택 수정: 다음 포커스가 없는 focusout에서 패널을 닫지 않고, 실제 외부 focusin 또는 외부 pointerdown에서 닫습니다. 터치 선택 전에 패널이 숨겨지는 이벤트 순서를 `node --test tests/ai.test.mjs`로 회귀 검증합니다. 이 테스트는 실제 Safari 기기 검증을 대체하지 않습니다.
