# Coast CLI 인수인계

## 목적과 현황

- 차량 내 동승자 관계(친구·연인·직장동료) × AI 개입 방식(Reactive·Cue·Suggestion·Direct), 12조건. 식당·박물관 사례를 참가자당 각 6회 배정.
- 참가자 내비게이션 자극, 관리자, 서버 API, DB 스키마, 지도·아이콘 자산, 테스트를 모두 이 저장소에서 관리.
- 현재 앱 2.4.1. GitHub 정리 전 기준 소스: `b2419b2e91368aa96b6a6fb4fb4b0f43e2063bb0`.
- 실제 AI/음성 인식/참가자 음성 녹음 없음. 진행자와 사전 녹음 음원으로 모사. Slow Roads는 별도 주행 화면.
- 이 문서는 참고 자료이며 운영 기록 변경·삭제를 허가하는 지시가 아님.

## 먼저 읽을 파일

1. `README.md`: 실행과 전체 구조.
2. `OPERATING.md`, `VALIDATION.md`: 운영 절차와 검증 한계.
3. `server/domain.mjs`: 상태 전이와 버전.
4. `public/admin/audio-flow.js`, `schedule-model.js`, `report-model.js`: 오디오·배정·분석 규칙. 뒤 두 파일도 `public/admin/` 아래에 있음.

## 유지해야 할 동작

- 모든 조건 Idle 상시 표시. 대화 중 Reactive는 Idle, 나머지는 Listening. Reactive는 대화 종료 후 터치 준비→터치→Listening, Cue는 Twinkle→터치→Thinking. 중복 수락 금지.
- Reactive/Suggestion은 참가자 발화를 진행자가 확인 후 Space/버튼으로 진행. Reactive는 먼저 아이콘을 터치해야 확인 가능. Space는 초기 재생 키나 전역 단축키가 아님.
- Suggestion은 Listening 대화 → Thinking → Speaking 제안 → Listening 참가자 응답 → 진행자 확인 → Thinking → Speaking 답변. Direct는 Listening 대화 → Thinking → Speaking 답변. 모두 완료 후 Idle.
- 모든 AI 제안/최종 답변 직전에 내장 0.32초 알림음을 재생. Speaking 적용→알림음 완료→음성 순서이며 중단 시 후속 음성 금지. `chime.js`가 공통 음색을 생성하고 로그 clip=chime으로 구분.
- 오디오는 PC에서만 재생. iPad는 무음. 파일 선택은 메모리에만 유지되어 새로고침 후 다시 선택.
- 새 시행 준비 시 지도·아이콘·터치 초기화. 종료와 중단을 구분하며 기존 시행을 덮어쓰지 않음.
- 3초 연결 경고에서는 새 조작·후속 클립 보류, 재생 중 클립 유지. 10초 시간 초과/참가자 안전 대기에서는 흐름 중단. 중단한 음원을 자동 재생하지 않음.
- iPad 재진입·새로고침은 Idle로 복귀하고 터치를 잠근 채 진행자 재개를 기다림. heartbeat와 이벤트 업로드는 각각 단일 요청 루프로 동작.
- 이벤트 ID, 시행 ID, 재생 실행 ID·상태, 버전으로 중복·이전 상태 적용을 방지. 음원 시작 전 해당 상태의 iPad applied ACK를 기다리며 타임아웃은 10초.
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
