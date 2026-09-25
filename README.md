# Coast · 캘리포니아 해안

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

