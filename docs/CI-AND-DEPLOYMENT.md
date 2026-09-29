# Cloudflare 전환 안내

사용자 요청에 따라 Cloudflare Workers + D1 + Access로 이전하는 구성을 추가했습니다. 새 자동 배포 설정은 [CLOUDFLARE.md](../CLOUDFLARE.md)를 따릅니다. 아래는 기존 Sites 배포 경로의 기록입니다. GitHub CI는 기존 Sites 번들과 Cloudflare 번들을 모두 검증합니다.

# GitHub 검증과 Sites 배포

## 자동화된 범위

`main` push, `main` 대상 PR, 수동 실행에 `.github/workflows/ci.yml`이 동작합니다.

1. Node.js 24와 package-lock.json으로 의존성 설치.
2. 기존 회귀 테스트 실행.
3. Sites Worker·UI·D1 마이그레이션 빌드.
4. 소스 커밋별 tar.gz, SHA-256 체크섬, source-commit.txt를 GitHub Actions 아티팩트로 14일 보관.

실패한 테스트나 빌드를 건너뛰지 않으며 실패 시 아티팩트를 게시하지 않습니다. 이 워크플로에는 운영 DB나 Sites 인증 정보가 제공되지 않습니다.

## 자동 배포가 연결되지 않은 이유

현재 사용 가능한 Sites 커넥터는 버전 저장·게시 도구와 단기 소스 저장소 쓰기 인증을 제공합니다. GitHub Actions가 사용할 영구 배포 키, GitHub 저장소 연결 또는 배포 webhook 설정은 제공된 인터페이스에서 확인되지 않았습니다.

일부 Sites 계정의 `publish_on_push`는 Sites 전용 소스 저장소와 만료되는 게시 허용 구간에 적용됩니다. `github.com/gngho/coast-touch-map`의 지속적인 자동 배포 연결을 뜻하지 않습니다. 해당 단기 토큰은 GitHub Secrets에도 저장하지 않습니다.

따라서 Actions 성공은 **검증·빌드 성공**이며 기존 chatgpt.site의 배포 성공이 아닙니다. 배포 단계로 표시되는 가짜 성공 작업이나 주기적 로컬 우회 작업은 구성하지 않았습니다.

## 현재 배포 절차

1. GitHub Actions에서 대상 커밋의 테스트와 빌드 성공 확인.
2. Sites 사용 가능한 환경에서 기존 Site를 열고 GitHub 변경을 반영. GitHub와 Sites 전용 소스 저장소는 별도이므로 기존 project_id를 유지하고 충돌·원격 최신 상태를 확인.
3. Sites 절차에 따라 정확한 소스를 전용 저장소에 push하고 같은 커밋의 빌드를 저장·비공개 배포.
4. 배포 상태 succeeded 확인. 실험 시행 종료 후 PC·iPad 화면을 새로고침하고 음원을 다시 선택.

GitHub 아티팩트를 사용할 때에는 source-commit.txt와 Sites에 push한 커밋이 일치해야 합니다. 합치기 등으로 커밋이 달라졌으면 새 HEAD에서 다시 빌드합니다. 운영 데이터 초기화나 공개 범위 변경은 필요하지 않습니다.

## 완전 자동 배포를 위한 별도 결정

외부 CI 인증을 지원하는 호스팅으로 옮기면 GitHub push 기반 배포를 구성할 수 있습니다. 현재 앱은 Worker·D1을 사용하므로 Cloudflare Workers·D1이 후보입니다. 그러나 URL, Sites 로그인에 의존한 사용자 식별, 운영 DB 및 접근 정책을 이전해야 합니다. 호스팅 변경은 사용자 결정과 대상 계정 권한을 확인한 후 별도로 진행합니다.
