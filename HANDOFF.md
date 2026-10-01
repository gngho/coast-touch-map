# Coast CLI 인수인계

## 목적과 현황

- 최신 설계: 친구(FR)·직장 관계(BU) × AI 4방식(RA/PC/PS/PD), 8묶음×2=16시나리오·설문 8회. 식당·카페·날씨·도로 각 4회.
- 참가자 내비게이션 자극, 관리자, 서버 API, DB 스키마, 지도·아이콘 자산, 테스트를 모두 이 저장소에서 관리.
- 현재 앱 2.9.1. GitHub 정리 전 기준 소스: `b2419b2e91368aa96b6a6fb4fb4b0f43e2063bb0`.
- 실제 AI/음성 인식/참가자 음성 녹음 없음. 진행자와 사전 녹음 음원으로 모사. Slow Roads는 별도 주행 화면.
- 이 문서는 참고 자료이며 운영 기록 변경·삭제를 허가하는 지시가 아님.

## 먼저 읽을 파일

### 2.9.1 참가자 분할 화면

- `public/index.html`, `workspace.css`: 좌측 AI 3 / 우측 지도 7, 간격 제외 너비 비율. 두 패널에 둥근 모서리 적용. 지도·설정 버튼은 지도 우측으로 이동.
- `public/ai-renderer.js`: WebGL 다층 리본. Listening은 뒤쪽 원형 파동, Twinkle은 후광. `ai.js`에서 기존 실험 상태를 렌더러에 전달하며 터치 수락·음원 타이밍은 그대로 유지. 초기 WebGL 실패 시 SVG 대체 표시.
- `public/prototypes/`는 이전 디자인 비교 시안. 실제 화면은 `/`에서 확인. Speaking은 합성 맥동이며 음원 진폭과 연결되어 있지 않음.
- 기존 61개 테스트 및 Cloudflare dry-run 빌드 통과. Chromium에서 1194×834, 834×1194, 1024×768 비율·상태 미리보기·설정 접근 확인. 실제 iPad 성능과 실기기 음원 동기화는 미검증.

1. `README.md`: 실행과 전체 구조.
2. `OPERATING.md`, `VALIDATION.md`: 운영 절차와 검증 한계.
3. `server/domain.mjs`: 상태 전이와 버전.
4. `public/admin/audio-flow.js`, `schedule-model.js`, `report-model.js`: 오디오·배정·분석 규칙. 뒤 두 파일도 `public/admin/` 아래에 있음.

## 유지해야 할 동작

- 모든 조건 Idle 상시 표시. 대화 중 Reactive는 Idle, 나머지는 Listening. Reactive는 대화 종료 후 터치 준비→터치→Listening, Cue는 Twinkle→터치→Thinking. 중복 수락 금지.
- Reactive/Suggestion은 참가자 발화를 진행자가 확인 후 Space/버튼으로 진행. Reactive는 먼저 아이콘을 터치해야 확인 가능. Space는 초기 재생 키나 전역 단축키가 아님.
- Suggestion은 Listening 대화 → Thinking → Speaking 제안 → Listening 참가자 응답 → 진행자 확인 → Thinking → Speaking 답변. Direct는 Listening 대화 → Thinking → Speaking 답변. 모두 완료 후 Idle.
- 모든 AI 제안/최종 답변 직전에 내장 0.5초 알림음을 재생. Speaking 전환 요청→알림음 완료→180ms→음성 순서이며 중단 시 후속 음성 금지. `chime.js`가 공통 음색을 생성하고 로그 clip=chime으로 구분.
- 오디오는 PC에서만 재생. iPad는 무음. 파일 선택은 메모리에만 유지되어 새로고침 후 다시 선택.
- 새 시행 준비 시 지도·아이콘·터치 초기화. 종료와 중단을 구분하며 기존 시행을 덮어쓰지 않음.
- 3초 연결 경고에서는 새 조작·후속 클립 보류, 재생 중 클립 유지. 10초 시간 초과/참가자 안전 대기에서는 흐름 중단. 중단한 음원을 자동 재생하지 않음.
- iPad 재진입·새로고침은 Idle로 복귀하고 터치를 잠근 채 진행자 재개를 기다림. heartbeat와 이벤트 업로드는 각각 단일 요청 루프로 동작.
- 참가자 터치는 활성화된 아이콘의 trusted pointerdown/up만 허용하며 click/키보드/활성화 전 누르기는 무시. 서버 activation에 event ID/page ID/trial ID/run ID/cue ID를 저장하고 현재 실행과 일치해야 답변 가능.
- PC 재생 로그 저장은 재생 흐름과 분리하고 실패 시 중단. iPad 터치·적용 확인·감사 로그를 별도 전송 루프로 처리해 저장 지연이 터치를 막지 않도록 함.
- 이벤트 ID, 시행 ID, 재생 실행 ID·상태, 버전으로 중복·이전 상태 적용을 방지. 초반 대화의 source.start() 이후 Listening을 요청. 일반 상태 변경은 applied ACK/로그 저장을 기다리지 않으며, Thinking 기본 500ms에서 명령 왕복 시간을 차감. Cue는 터치 이후 이미 지난 Thinking 시간을 차감. 터치 준비는 ACK 또는 일치하는 수락 기록을 기다리며 타임아웃 10초.
- 기록 초기화는 영구 삭제. 확인 문구와 시행 수 검증 유지. 실제 사용자 기록으로 테스트하지 말 것.
- iPad 아이콘 상태 미리보기는 null relatedTarget의 focusout으로 닫지 않음. 기존 focusin/외부 pointerdown 처리가 터치 이벤트 유실을 방지함.

## 측정·데이터

- Cue 반응시간은 동일 iPad 표시 적용 → 수락된 첫 터치. PC/iPad 시각 직접 차감 금지.
- Reactive 터치 준비→첫 터치는 별도 iPad 지표이며 Cue 반응시간과 구분. 2.4 이전 시행과 자극/흐름이 다르므로 버전 보존.
- Reactive/Suggestion 확인 간격은 동일 PC 페이지·재생 실행에서 대화/제안 종료 → 진행자 확인. 순수 참가자 반응시간으로 표현하지 않음.
- Web Audio 시작·종료는 브라우저 호출·콜백이며 실제 TV 음향 onset이 아님.
- 미측정은 0과 구분. 서버 저장 순서는 오프라인 지연 업로드 영향을 받을 수 있음.
- 운영 DB·CSV·음원은 Git 이관과 별개. 연구 자료를 임의 커밋하지 말 것.

## 실행·배포

- GitHub Actions 자동 검증·빌드·아티팩트 저장 추가. `.github/workflows/ci.yml`과 `docs/CI-AND-DEPLOYMENT.md` 참고. GitHub에서 Sites로의 자동 운영 배포는 연결되지 않았으며 완료로 표현하지 말 것.

- Node.js 24+에서 `npm ci`, `npm test`, `npm run build`, `npm start`.
- 로컬 서버는 loopback 전용 테스트 계정. 외부 공개 금지.
- Cloudflare 이전 구성은 `CLOUDFLARE.md` 참조. Workers Builds 연결 후 main push → 테스트·번들 검증 → D1 마이그레이션 → 자동 배포. 계정 연결 전에는 활성화된 것으로 간주하지 않음.
- `npm run build`는 Cloudflare dry-run, `npm run build:sites`는 기존 Sites 빌드. Access JWT 검증 없이 운영 API를 공개하지 않음.
- `.openai/hosting.json`의 기존 project_id와 비공개 접근 정책을 유지.
- 기존 데스크톱 자동 테스트 37개 통과 기록이 있음. 실제 iPad Safari·TV·장시간 파일럿을 검증 완료로 단정하지 않음.

## CLI 시작 요청 예시

> README.md, HANDOFF.md, OPERATING.md, VALIDATION.md를 읽고 참가자 화면 → 조건 배정 → 시행 제어 → PC 음원 → 로그 저장 흐름을 파악해줘. 운영 실험 기록은 변경하지 마.


## 2026-09-30: paired-v2 배정
- 새 배정표는 `williams12-paired-v2`. 기존 `williams12-poi-v1`은 `schedule-legacy.js`로 원래 배정과 진행률 유지.
- 24개 episode를 각각 독립된 trial/run으로 시작하므로 음원 선택·터치·아이콘 상태가 매번 초기화된다. 둘째 episode 종료 후 `complete_survey`를 호출해야 다음 묶음을 준비할 수 있다.
- 설문 응답은 외부에서 수집. admin은 완료 시각·참가자·planId·blockPosition을 `survey_completed` 세션 이벤트로 기록한다. DB 스키마 변경 없음.
- 배정 CSV 및 시행 요약에 묶음/episode/군/유형/순서를 기록. 음원은 수동 선택하며 카페·도로 음원 제작은 별도 작업.
- 12명 단위 Williams 묶음 순서 균형, 24명 단위 조건별 네 조합×두 순서 각 3회. 이는 표본 수 권고가 아니며 episode 전체의 모든 전이 균형이나 조건×위치×유형의 완전 교차 균형을 뜻하지 않는다.

## 2.9.1 수동 배정 선택 / 새 관계 설계

- 최신 `williams8-paired-v3`: 8명 주기 위치·직전 조건 균형, 16명 주기 사례 조합·순서 균형. BU는 기존 내부 키 coworker를 사용하며 화면에는 직장 관계로 표시.
- `schedule-paired-v2.js`, `schedule-legacy.js`는 기존 저장 배정의 재현용. 기존 배정·기록을 변환하지 않음.
- 수동 prepare는 `schedule.selection=manual`, reason, previousAttemptIds, expectedNextPosition을 기록. 완료 시나리오도 새 trial/run으로 재시행. 기존 완료·설문 상태 유지, 후속 자동 진행은 첫 미완료부터.
- 최신 관계 변경은 Study Plan.md의 변경 메모를 우선 적용. 기존 본문 및 AGENTS의 3관계/12조건은 이전 설계임.

## 2.9.1 네 점 AI와 이동 경로

참가자와 관리자는 `dot-ai.js/css`를 공유한다. Idle 네 점 정지, Listening 순차 바운스, Thinking 시계방향 회전, Speaking 두꺼운 막대 높이 변화. Twinkle은 같은 회전과 AI 패널 테두리 발광, “원하는 정보를 드릴 수 있어요!” 말풍선이다. WebGL 구체는 이전 시안에만 보존한다.

지도에는 저장된 약 9.5km 경로 전체를 표시하며 화살표는 기존 출발점에서 북쪽으로 초당 6m 이동한다. 끝에서는 정지하고, 초기화 및 새 시행 준비 시 같은 위치로 복귀한다. 숨겨진 탭이나 동작 줄이기 설정에서는 이동을 멈춘다. Speaking은 음성 진폭 분석이 아닌 상태 기반 애니메이션이다.

- 2.9.1: 참가자/관리자 아이콘 아래 상태 텍스트는 화면에서 제거(접근성용 상태/버튼 설명은 유지). Twinkle은 4.8초 회전·위 바운스·중앙 수렴·재확산 동작이며 패널 빛을 내부까지 확대. Thinking은 기존 단순 회전 유지.
