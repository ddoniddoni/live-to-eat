# 04. 개발계획, 실행 지침과 진행 기록

버전 3.1 | 2026-09-13 | 단일 개발 진행 문서

## 1. 개발 원칙

LiveToEat은 React Native + Expo로 만드는 iOS/Android 앱이며, 공유 링크 열람만 작은 웹 화면으로 제공한다. npm workspaces와 루트 `package-lock.json` 하나를 사용하고, TypeScript strict·런타임 입력 검증·번역 키·제공자 DTO와 사용자 데이터 분리를 기본으로 한다.

각 작업은 관련 요구사항, 변경 파일, migration 여부, 실제 실행 명령과 검증 상태를 이 문서에 기록한다. 외부 키·계정·결제·도메인이 없어서 실행하지 못한 기능은 완료라고 쓰지 않는다. 비밀값은 소스·로그·채팅에 넣지 않는다.

2026-09-13 사용자 결정으로 **국내 서비스, 네이버 Maps, 공공데이터 기반 자체 장소 DB**를 확정했다. 앱과 공유 웹은 네이버 지도를 표시하고 검색·상세·저장은 자체 장소 UUID와 DB를 사용한다. 기본 원본은 소진공 상가정보, 인허가 자료는 검증 후 보완한다. 네이버/카카오 검색은 선택적 보조 후보이며 P0 의존성이 아니다.

현재 코드·환경변수 예시·의존성·migration은 전환 전이다. 이번에는 문서를 먼저 갱신했으며 SDK 교체, 자료 적재, DB/API 전환과 실기기 검증을 완료하지 않았다. 아래 날짜별 기록은 당시 구현·검증 이력이다. 새 설계와 충돌하는 이전 외부 API 구현은 유지할 요구사항이 아니라 후속 전환 대상이다.

## 2. 도구와 환경

로컬은 지원 Node LTS/npm, Git, Android Studio/JDK, Docker/Supabase CLI를 준비한다. iOS 로컬 빌드와 시뮬레이터는 macOS/Xcode가 필요하며, 클라우드 빌드는 실기기 확인을 대체하지 않는다.

development/preview/production은 앱 식별자, Supabase 설정, 네이버 Maps 애플리케이션/웹 도메인, EAS channel을 분리한다. 개발 앱이 production DB를 기본값으로 쓰지 않으며 지도 클라이언트 식별자와 서버·공공 API 인증 비밀을 구분한다.

| 명령 | 실제로 실행할 작업 |
|---|---|
| `npm run dev:mobile` | mobile workspace에서 Expo dev client 시작 |
| `npm run dev:share` | 작은 공유 웹 개발 서버 |
| `npm run lint` | 앱/공통/웹/서버의 해당 lint |
| `npm run typecheck` | 앱/웹/공통 타입 및 Edge 별도 타입 검사 |
| `npm run test:unit` | 도메인·컴포넌트 테스트 |
| `npm run test:db` | 로컬 Supabase의 SQL/RLS/트랜잭션 테스트 |
| `npm run test:e2e` | 준비된 실제 앱/시뮬레이터 대상 E2E |
| `npm run build:share` | 공유 웹 production bundle |
| `npm run check` | lint, typecheck, unit, 문서 참조 검사. DB/E2E는 별도 선행 환경 명시 |

기존 의존성 설치·검사 예시:

```bash
npm install
cd apps/mobile
npx expo install --check
npx expo-doctor
```

네이버 지도 래퍼는 B02에서 현재 Expo/RN 호환 버전을 검증한 뒤 exact로 설치하고 plugin과 lockfile을 함께 변경한다. 위 명령은 네이버 지도 전환을 수행하지 않는다.

개발 중에는 `npm install`, CI에서는 `npm ci`를 사용한다. Supabase CLI/EAS CLI/Firebase CLI는 devDependency 버전을 고정한다.

## 3. 환경변수와 지도 설정

아래는 **후속 구현에서 적용할 목표 환경변수 예시**다. 네이버/공공 API 변수명은 이 프로젝트의 제안 이름이며 현재 `app.config.ts`나 `.env.example`에 연결된 상태가 아니다. B02/B05에서 실제 SDK·적재 설정과 함께 확정한다.

```dotenv
APP_VARIANT=development
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
EXPO_PUBLIC_SHARE_ORIGIN=https://example.invalid
APP_IOS_BUNDLE_ID=com.ddoni.livetoeat.dev
APP_ANDROID_PACKAGE=com.ddoni.livetoeat.dev
APP_SCHEME=live-to-eat-dev
NAVER_MAPS_CLIENT_ID=YOUR_REGISTERED_MAPS_CLIENT_ID
```

공유 웹의 목표 공개 설정은 `VITE_NAVER_MAPS_CLIENT_ID`이며 허용 웹 도메인을 등록한다. 공공 API를 사용할 경우 `PUBLIC_DATA_API_SERVICE_KEY`는 서버/운영 전용이다. CSV 기본 적재와 API 활용신청은 별개다. Supabase service role/secret, OAuth client secret, Apple .p8와 철회 토큰 암호화 키도 서버 비밀 저장소에만 둔다.

`app.config.ts`와 환경변수 검증은 새 네이버 지도 plugin, 앱 식별자, build variant에 맞춰 후속 수정한다. 현재 필수 설정을 문서 예시만 보고 제거하지 않는다. native 의존성/plugin 변경 뒤에는 새 development/preview/store binary와 공유 웹 빌드를 검증한다. [D1]

## 4. 단계별 작업과 인수 기준

| 단계/작업 ID | 개발 내용 | 완료 증거 | 요구사항 |
|---|---|---|---|
| M0 / B01 | 기존 저장소 확인, RN/Expo/Node/지도 호환 버전 고정, npm workspace | lockfile/버전표, iOS/Android dev build 생성 | R20 |
| M0 / B02 | 공공 장소 표본 품질, 네이버 지도 앱/웹 호환성·비용 검증 | 지역/업종별 검색·중복·좌표 보고, 양 플랫폼 타일/마커/클러스터, 웹 지도, 실제 호출 계측 | R02,R17 |
| M1 / B05 | 자체 장소·출처·적재 이력·국내 지역, 저장 연결 migration/RLS/RPC | staging/멱등 갱신, 기존 사용자 기록 보존, clean apply·권한 SQL 테스트 | R01,R02,R07,R09 |
| M1 / B06 | 이메일·Google·Apple 인증, 프로필/언어/온보딩/세션 | 실제 계정 가입 확인/로그인/재실행/로그아웃/복구/교차 플랫폼 확인 | R12,R19 |
| M2 / B07 | 자체 DB 검색/상세, 자체 장소 ID 저장, 편집/중복/개인 폴더 | 검색·페이지네이션→저장→재실행, 잘못된 지점 연결 방지와 기존 API 전환 | R01,R02,R03 |
| M2 / B08 | 내 지도/목록/지역/클러스터/좌표 미확인 | 위치 거부, 500개 합성 기록, 국내 지역·좌표·점진 표시 테스트 | R01,R07,R17,R19 |
| M4 / B12 | 공개 지도/둘러보기/타인 저장 | A 공개→B 발견→B private 저장, 비공개 누출 없음 | R04,R05,R06 |
| M4 / B13 | 지역 공유 생성/만료/철회/epoch | 허용 장소만 표시, private 복귀 후 옛 링크 부활 없음 | R08,R09,R10 |
| M4 / B14 | 작은 웹/자체 도메인/AASA/App Links | 미설치 iOS/Android 브라우저 지도 열람, 설치 앱 이동 | R11,R19 |
| M5 / B15 | 신고/차단/운영 숨김, 문의, 내보내기, 탈퇴 | 실제 처리 경로, Apple 철회/삭제 재시도/복원 검사 | R16,R18,R12 |
| M5 / B16 | 비용/성능/접근성/개인정보/릴리스 점검 | 05의 정의된 테스트 증거와 해결된 blocker | R17,R18,R19,R20 |
| M6 / B17 | TestFlight/Play 테스트, 수정, 스토어 제출 | 실제 테스트 빌드 ID, 테스트 결과, 제출 상태 | R20 |
| M6 / B18 | 스토어 승인/국가 선택/단계 배포/운영 검증 | 양 스토어 공개 URL, 삭제/신고/장애 대응 실사용 확인 | R20 |

첫 출시 카탈로그와 검색은 국내로 제한한다. B05부터 국가 코드·가변 깊이 지역 구조를 유지하고, B06부터 한국어/영어 UI를 검증한다. 해외 검색·카탈로그·날짜변경선 테스트는 첫 출시 범위 밖이다. 작은 공유 웹은 앱을 대체하는 첫 제품이 아니라 앱이 없는 사람의 공유 열람을 위한 제한된 범위다.

### 다음 실행 순서

1. B02에서 수도권·광역시·지방·제주의 음식점/카페/베이커리 표본을 선정하고 검색 누락·중복·좌표·신규/폐업 반영을 측정한다. 표본·분모·허용 기준을 먼저 기록한다.
2. B02에서 현재 Expo/RN의 네이버 지도 래퍼를 검증하고 iOS/Android/공유 웹의 타일·마커·클러스터·선택·위치 거절·로고·호출 계측 결과를 남긴다. 실패하면 데이터 보완 또는 앱 연결 방식을 재검토한다.
3. B05에서 자체 장소/출처 모델, 검증 후 반영하는 적재와 갱신, 기존 저장의 안전한 연결을 구현한다. 잘못된 매칭·누락·재실행·실패 복구를 검증한다.
4. B07/B08/B12/B14에서 자체 DB 검색·상세·내 지도·타인 재저장·공유 웹을 연결하고 이전 외부 API 의존성·설정·계약을 정리한다. B13의 서버 공유 권한은 계속 별도로 검증한다.
5. B15/B16에서 출처 포함 내보내기, 데이터 갱신 운영, 비용·개인정보·접근성을 검증한 뒤 M6로 진행한다.

네이버 지도·자체 장소 DB의 실제 연동과 자료 적재는 위 순서의 후속 작업이다. 2026-09-13 문서 변경 후 사용자가 기존 미커밋 구현 전체의 커밋·푸시와 develop 통합도 요청했다. Git 반영을 새 연동 완료, 운영 환경 변경 또는 유료 서비스 가입 승인으로 해석하지 않는다.

## 5. 검증 규칙

일반적으로 작업 전후에 관련 lint/typecheck/unit을 실행하고, DB 변경은 로컬 SQL 테스트, native 변경은 해당 플랫폼 빌드에서 검증한다. 다만 사용자가 해당 작업의 검증 실행을 명시적으로 보류하라고 하면 실행하지 않고 미실행으로 기록한다.

DB migration은 이미 적용한 역사 migration을 수정하지 않는다. 제거·계약 축소는 새 migration에서 수행하고, 로컬 reset부터 clean apply와 소유권/RLS를 검증한다. 이전 앱 버전과의 호환을 고려해 expand→migrate→contract 순서를 따른다.

작업 기록 형식:

```text
작업: Bxx / 관련 Rxx
변경: 경로와 주요 변경
실행: 실제 실행한 명령/플랫폼/환경
검증: 성공/실패/미실행과 증거 위치
정책/비용: 변경 유무
남은 것: blocker와 다음 작업
```

## 6. 현재 상태

| 항목 | 현재 상태 | 증거/다음 행동 |
|---|---|---|
| 문서 패키지 | UPDATED | 국내/네이버 지도/자체 장소 DB 설계 확정, 제품·구조·API·갱신·출시 계약 동기화 |
| Expo/RN/Node exact version | 기존 기반 검증 | lockfile 고정. 새 네이버 지도 래퍼 버전·호환성은 별도 검증 전 |
| iOS/Android build | PARTIAL | Android debug APK 빌드 성공 기록. iOS JS bundle 성공, 네이티브 빌드는 Xcode 미설치로 BLOCKED |
| 네이버 앱 지도·공유 웹 지도 (B02) | NOT_STARTED | 기존 지도 화면은 있으나 새 SDK/plugin/환경 설정·실기기·웹 전환은 미실행 |
| 공공 장소 데이터 품질·적재 (B02/B05) | NOT_STARTED | 공식 자료·이용 조건 조사만 완료. 표본 측정·전체 적재·갱신·좌표 변환 검증 전 |
| 자체 장소 DB 검색·상세 (B07) | NOT_STARTED | 자체 ID/페이지네이션/검색·상세 DTO는 문서 계약만 확정 |
| Supabase migration/RLS (B05) | PARTIAL | 계정 상태·개인 저장·가변 깊이 지역 migration/RLS/제한 상태 RPC를 작성했다. 새 자체 장소·출처·적재 모델은 미구현이다. `npm run test:db`는 로컬 Postgres 미실행으로 `127.0.0.1:54322` 연결이 거부됐고, Docker CLI도 없어 migration/RLS SQL 검증까지 진행하지 못했다 |
| 이메일·Google·Apple 인증·온보딩·세션 (B06) | PARTIAL | 브랜드 로딩, 이메일 로그인·회원가입, 가입 확인·비밀번호 복구 앱 링크, 새 비밀번호 변경, 2단계 프로필·비공개 원칙 온보딩과 제한 RPC·소셜 인증 흐름을 작성했다. Supabase 이메일/provider·SMTP·Redirect URL·Apple 식별자 설정, 법적 문서 URL·버전, DB 적용과 실제 계정/메일/양 플랫폼 링크 검증이 남았다 |
| 장소 검색·비공개 저장 기반 (B07) | PARTIAL | 검색→확인→비공개 저장, 개인 폴더, 개인 기록 수정/삭제 UI와 Edge/RPC source를 추가했다. DB 적용·Edge 배포·실계정 확인은 미실행 |
| 외부 목록·링크 입력 | 제거됨 | 장소 입력을 검색으로 단순화하고, 기존 개인 저장을 보존하는 cleanup migration을 추가 |
| 내 지도·목록·지역 필터 (B08) | PARTIAL | 지도 핀/클러스터, 저장 목록 동기화, 지역·미분류 필터, 이전 외부 상세 조회와 refresh quota source가 남아 있다. 자체 DB 조회로 전환해야 한다. DB 적용·Edge 배포·실계정/실기기 검증은 미실행 |
| 공개 지도·둘러보기·타인 저장 (B12) | PARTIAL | 공개 지도 on/off·장소별 public 전환, 서버 전용 공개 지도 DTO, 타인 장소의 private 재저장 source를 작성했다. DB 적용·Edge 배포·실계정/교차계정 검증은 미실행 |
| 앱 디자인·탭·체험 데이터 | FRONTEND_VERIFIED | 3개 탭, 공통 액션, 자체 일러스트·아이콘, 편집/폴더/프로필/한국어·영어를 구현했다. 예시 데이터로 브라우저 동작 확인. 실제 계정 검증은 별도 |
| 공유 생성·관리 (B13) | UI_AND_DOMAIN_ONLY | 지역→선택→미리보기→공개범위 동의→만료 설정, 기기 내 초안·철회와 권한 규칙 테스트. 서버 링크 생성/재발급/철회는 보류 |
| 작은 공유 웹 (B14) | UI_ONLY | 예시 지도/목록/상세, 언어 선택, 잘못된 링크·만료·연결 실패 화면. 실제 권한 조회·앱 연결·도메인은 미연동 |
| 프로필·내보내기·차단 (B15) | PARTIAL_FRONTEND | 체험 프로필 편집·차단, JSON/CSV 파일 내보내기. 실계정 전체 내보내기·신고 접수·지원 운영·계정 탈퇴는 미구현 |
| 품질·접근성·출시 점검 (B16) | PARTIAL | 단위 테스트 16건·번역 370키·브라우저 320/390px 검사·양 플랫폼 JS bundle·Android debug APK 확인. 네이티브 접근성/실기기/스토어 검증은 남음 |
| 스토어 계정/인증서/도메인 | OWNER_SETUP_REQUIRED | 소유자 명의로 설정 |
| 베타/심사/공개 출시 | NOT_STARTED | M6, 승인과 공개를 별도 기록 |

버전 기록 슬롯: Node=24.20.0 / npm=11.17.0 / Expo=57.0.21 / React Native=0.86.3 / 네이버 지도 래퍼=호환 버전 검증 전 / iOS 최소 OS=16.4 / Android minSdk=24 / targetSdk=36 / EAS build image=미정.

## 7. 결정 기록

| 날짜 | 결정 | 이유 |
|---|---|---|
| 2026-09-09 | 웹 우선 대신 React Native 앱 출시 | 사용자 명시 방향 |
| 2026-09-09 | 개인 폴더 P0 | 내 저장을 원하는 방식으로 분류 |
| 2026-09-09 | 작은 공유 웹 P0 | 앱 미설치자의 지역 공유 열람 유지 |
| 2026-09-09 | 제품명 `LiveToEat`, 저장소/패키지명 `live-to-eat` | 사용자 지정 |
| 2026-09-09 | 공유 웹은 Vite + React로 구성 | 앱 미설치 열람에 필요한 작은 정적 웹 범위 유지 |
| 2026-09-10 | B06의 계정 초기화·온보딩은 제한 RPC로만 허용 | 인증된 사용자가 자기 `auth.uid()`에 대해서만 onboarding→active 전환 |
| 2026-09-10 | 첫 실행 UI 언어는 한국어 | 인증 전·미리보기의 기본 `lng`는 `ko`, 활성 계정의 선택은 계속 우선 |
| 2026-09-10 | 장소 입력 경로 단순화 | 외부 목록·링크·공유 수신의 임시 처리 기능을 제거하고 검색 결과 선택 흐름 유지 |
| 2026-09-12 | Maps·Supabase 연동은 사용자 요청으로 보류하고 앱 UI·도메인·로컬 체험부터 구현 | 실제 서비스 완료와 체험 기능 검증을 분리. Expo 웹은 개발 검증 전용이며 전체 웹앱으로 배포하지 않음 |
| 2026-09-11 | 공개 지도 조회는 service role 전용 DB DTO로 한정 | base table의 공개 RLS 정책을 열지 않고, active·공개 지도·public 저장 조건과 응답 필드 제한을 Edge 경계에서 함께 강제 |
| 2026-09-12 | 서비스 범위를 국내로 변경 | 해외 검색/출시는 P0에서 제외하고 비용·장소 재사용 조건 조사 |
| 2026-09-13 | 네이버 Maps + 공공데이터 기반 자체 장소 DB 확정 | 사용자 승인. 자체 UUID로 저장/공유, 소진공 기본 원본, 인허가 보완. 보조 검색은 선택 사항 |
| 2026-09-13 | 문서부터 전환, 데이터 품질·양 플랫폼 지도 검증 우선 | 현재 코드는 전환 전. 기존 데이터·UI 작업을 보존하며 SDK/DB/API를 후속 변경 |

## 8. 문서 패키지 QA

문서 변경 뒤 파일 수, UTF-8 인코딩, 상대 링크, 코드블록, 예시 문법, 비밀키 포함 여부를 검사한다. 이 검사는 앱·SQL·스토어 기능 테스트와 다르다.

2026-09-11의 외부 장소 입력 제거 범위에서는 `npm run check`를 실행해 lint, TypeScript, 단위 테스트 2건, 문서 검사를 통과했다. 변경 범위 React Doctor는 기존 장소 관리 화면의 경고 9건을 보고했지만 이번 변경 줄의 새 경고는 보고하지 않았고, 도구 내부 유지보수 검사 실패로 점수는 산출하지 못했다. `npm run test:db`는 로컬 Postgres가 실행 중이지 않아 `127.0.0.1:54322` 연결이 거부됐으며, Docker CLI도 사용할 수 없었다. Supabase local start/reset·migration apply, Edge 배포, Expo 실행과 실제 외부 지도/장소 API 호출은 실행하지 않았다. 새로운 cleanup migration의 DB 적용·RLS 및 기존 저장 보존은 로컬 Supabase 환경을 준비한 뒤 별도로 검증해야 한다.

## 9. 작업 기록

### 2026-09-09 — B01 기반 설정

- 작업: B01 / R20
- 변경: npm workspaces 루트, Expo Development Build 모바일 앱, Vite 공유 웹, 공통 도메인 패키지, Supabase 로컬 디렉터리와 환경변수 예시를 생성했다.
- 검증: 이전 기록상 lint/typecheck/문서 검사와 단위 테스트, Expo Doctor, 양 플랫폼 JS bundle, 공유 웹 build, Android debug APK가 성공했다. 실제 지도 타일은 제한된 키를 설정한 뒤 검증해야 한다.
- 남은 것: 당시 기반 검증에 필요한 Xcode·외부 설정·Docker·실기기 준비가 남았다. 현재 지도 검증 대상은 B02의 새 설계를 따른다.

### 2026-09-09 — B02 초기 지도 화면 (전환 대상)

- 작업: B02 / R02, R17
- 변경: 당시 외부 지도 SDK로 내 저장을 표시하는 초기 화면을 추가했다. 이 SDK와 초기 범위는 국내 네이버 지도 설계로 전환할 대상이다.
- 검증: 이전 기록상 Android Expo export와 lint/typecheck가 통과했다. 실제 지도 렌더링은 키·실기기 검증 전이다.
- 남은 것: B02의 새 네이버 지도 렌더링·고지·호출 계측과 공공자료 품질을 검증한다.

### 2026-09-10 — B05~B07 저장 기반

- 작업: B05, B06, B07 / R01,R02,R03,R07,R09,R12,R19
- 변경: 계정 상태·가변 깊이 지역·개인 저장·개인 폴더 migration/RLS/RPC, Google/Apple 로그인과 온보딩, 당시 외부 검색 ticket 및 private 저장 UI/Edge 경계를 추가했다. 검색·저장 식별자 계약은 새 자체 DB로 전환해야 한다.
- 검증: migration 적용, RLS SQL, Edge 배포, 실제 계정과 외부 장소 API 호출은 미실행이다.
- 남은 것: 개발 Supabase·provider·키를 소유자가 설정한 뒤 실제 계정으로 검색·저장·재실행·수정/삭제를 검증한다.

### 2026-09-11 — 외부 장소 입력 흐름 제거

- 작업: 범위 변경
- 변경: 파일 파서·파일 선택·행 검토·batch RPC, 링크 붙여넣기·OS 공유 inbox·네이티브 share module을 제거했다. Domain 계약·로케일·앱 설정·문서를 지도 표시와 검색 결과 선택만 남도록 갱신했다. 새 Supabase cleanup migration은 임시 테이블과 전용 RPC·ticket 보조 컬럼을 제거한다.
- 실행: `npm run check`와 변경 범위 React Doctor를 실행했다. `npm run test:db`도 실행했지만 로컬 Postgres가 실행되지 않아 `127.0.0.1:54322` 연결이 거부됐고 Docker CLI도 사용할 수 없었다. DB migration apply, Expo 실행과 실제 API 호출은 실행하지 않았다.
- 검증: lint, TypeScript, 단위 테스트 2건과 문서 검사는 통과했다. React Doctor는 이번 변경 줄의 새 경고 없이 기존 장소 관리 화면의 경고 9건을 보고했으며, 점수는 도구 내부 유지보수 검사 실패로 산출하지 못했다. cleanup migration 적용 후 기존 개인 저장이 보존되고 제거 대상 전용 리소스만 사라지는지는 로컬 Supabase에서 확인해야 한다.
- 당시 범위: 장소 입력을 검색 결과 직접 선택으로 한정했다. 지도·검색 제공자와 비용 계약은 2026-09-13 설계로 대체한다.

### 2026-09-11 — B08 내 지도·목록·지역 필터

- 작업: B08 / R01,R07,R17,R19
- 변경: 내 지도를 별도 화면으로 분리해 저장 수, 지역 칩, 지도 핀/클러스터, 선택 지역의 최근 저장 목록을 한 흐름으로 연결했다. 지역이 없거나 위치를 확인하지 못한 장소는 숨기지 않고 별도 상태와 목록으로 안내한다. 핀이나 목록을 선택하면 기존 개인 기록 편집 화면을 연다. 미리보기에는 서울 지역과 위치 미확인 예시를 제공한다.
- 당시 서버 경계: 인증·active 상태의 본인 resolved 저장만 읽고 외부 상세 응답으로 화면 DTO를 구성했다. 서버 한도와 개인 기록 권한 경계는 유지하되 장소 조회는 자체 DB로 전환해야 한다.
- 실행/검증: 사용자 요청에 따라 lint/typecheck/unit, Supabase local start/reset·migration apply, Edge 배포, Expo 실행과 실제 외부 지도/장소 API 호출은 실행하지 않았다.
- 남은 것: 로컬 DB에서 새 migration의 권한·한도와 cleanup migration 뒤의 clean apply를 검증한다. 실제 계정의 저장 재실행, 500개 기록의 점진 표시, 새 지도 설정·조회 비용·저작자 표시, iOS/Android 접근성과 위치 거절을 확인한다.

### 2026-09-11 — B12 공개 지도·둘러보기·타인 저장

- 작업: B12 / R04,R05,R06,R09,R17,R19
- 변경: 앱에 둘러보기 진입점, 공개 지도 목록·상세 지도, 내 공개 지도와 장소별 공개 전환, 타인 장소의 내 지도 저장 UI를 추가했다. 공개 지도 카드와 상세 DTO에는 공개 프로필, 공개 장소 개수, 현재 조회한 장소명·주소·좌표·공개 메모만 담고, 개인 메모·태그·방문 기록·폴더는 내려주지 않는다.
- 당시 서버 경계: server-only discovery/read 함수는 공개 지도 활성·public·resolved·원작자 active를 함께 검사하고, 인증·active 요청자에게 제한 DTO를 반환하도록 작성했다. 외부 상세 조회와 외부 식별자 재저장은 자체 DB/UUID로 전환해야 한다. 현재 공개 상태 재검사, private/want 재저장, 원본 개인 기록·공개 설명 미복제 규칙은 유지한다.
- 실행/검증: 사용자 요청에 따라 lint/typecheck/unit, Supabase local start/reset·migration apply, Edge 배포, Expo 실행과 실제 외부 지도/장소 API 호출은 실행하지 않았다.
- 남은 것: 지역 카탈로그·하위 지역 선택이 준비되면 둘러보기의 지역 조건을 연결한다. 로컬 DB에서 함수 grant/RLS·동시 재저장·공개 해제 직후의 접근 차단을 확인하고, A/B 실계정으로 공개→둘러보기→private 재저장과 비공개 누출 부재를 검증한다.


### 2026-09-12 — B06~B16 앱 경험·디자인 및 연동 없는 검증

- 범위: 사용자가 Maps·Supabase 연동을 보류하고 전체 앱과 출시 수준의 디자인 구현을 요청했다. 기존 작업 트리의 API·migration 변경을 보존했고 이번 작업에서 DB 적용, API 배포, 실계정 생성, 지도 호출, 프로덕션 변경, 스토어 제출은 하지 않았다. Git 브랜치·커밋·푸시도 하지 않았다.
- 디자인: 토마토 레드/밝은 바탕/세이지 색상, 타입·간격 토큰, 44px 이상 주요 터치 영역, SVG 아이콘·음식/지도 일러스트, 앱 아이콘·adaptive icon·스플래시를 추가했다. 이미지들은 허구의 예시와 장식이며 실제 지도 타일/음식점 사진으로 표시하지 않는다. `내 지도 / 둘러보기 / 프로필` 탭과 공통 저장 버튼, 검색·편집·선택 sheet, 온보딩, 빈 상태·실패·재시도·저장 피드백, 변경 취소/삭제 확인을 연결했다.
- 앱 동작: 검색/태그/개인 메모/지역·방문·추천·폴더 필터, 이름순/최근순, 중복 저장 방지, 방문 후 추천, 개인 메모와 별도 공개 설명, 공개범위 선택, 폴더 생성/이름 변경/삭제, 프로필·언어·공개 지도 설정을 구현했다. 메인 장소 목록은 FlatList를 사용한다. 기존 live API를 유지하며 신규 서비스 통합은 보류했다.
- 체험 경계: `EXPO_PUBLIC_AUTH_PREVIEW=true`에서만 `features/notebook/demoData.ts`의 자체 예시를 사용하고 버전 검증된 기기 파일/웹 localStorage에 저장한다. 외부 장소 DTO나 실계정 기록은 이 저장소에 쓰지 않는다. 비동기 저장을 직렬화하며 실패를 화면에 표시한다. production 빌드는 체험 모드를 거부하고 EAS production 환경에서 명시적으로 끈다. `npm run preview:web --workspace=@live-to-eat/mobile`은 모바일 UI 개발 확인 전용이다. 기존 `.env.example`의 비밀값 없는 개발 식별자/자리표시자 설정을 먼저 준비한다.
- 공유·도메인: 선택 지역 안의 최대 200곳, 명시적인 private→unlisted 동의, 고정된 저장 ID 스냅샷, 만료/철회, 비공개·삭제·지역 변경 후 옛 공유에 재등장하지 않는 규칙을 순수 TS로 구현했다. 체험에서는 기기 내 공유 초안으로만 저장하며 유효한 외부 링크를 만들어낸 것처럼 표시하지 않는다. 실제 서버 트랜잭션·권한 검증의 대체가 아니다.
- 내보내기: 본인 작성 태그/폴더/방문 상태/추천/공개범위와 선택한 개인 메모만 JSON/CSV로 만든다. 제공자 장소명·주소·좌표는 제외하고 CSV 수식 삽입을 방어한다. native는 캐시 파일과 OS 공유 창, 웹은 다운로드를 사용한다. live 화면은 현재 불러온 기록 수를 표시하며 전체 계정 내보내기라고 부르지 않는다.
- 공유 웹: `apps/share`의 기존 기반 안내를 읽기 전용 공유 경험으로 바꾸었다. 허구의 예시는 개발 서버의 `/?preview=1`에서만 노출된다. 실제 링크는 연결 실패/잘못된 링크 상태로 처리하며 권한 확인 없이 장소를 반환하지 않는다. 개발용 만료 예시는 `/?preview=1&state=expired`. 공개 서비스와 앱 링크는 아직 연결하지 않았다.
- 의존성: Expo에 맞는 `react-native-svg@15.15.4`, `expo-file-system@57.0.7`, `react-native-web@0.21.2`, `react-dom@19.2.3`를 exact로 추가하고 루트 lockfile을 갱신했다. 기존 Node 요구사항 24.20.0/npm 11.17.0을 사용했다. 설치 시 npm이 보고한 15개 moderate 의존성 감사 항목은 별도 출시 검토가 필요하며 강제 일괄 업데이트는 하지 않았다.
- 자동 검증: `npm run check` 통과 — lint 오류 0(보류한 기존 MapCanvas 기본 배열 경고 1), 모든 workspace TypeScript, 도메인 13건 + 기기 저장 어댑터 3건의 단위 테스트, 문서 검사, 신규 `check:locales`의 한국어/영어 370키·변수·정적 참조 검사. 저장 어댑터 테스트는 Expo 파일 API를 모의하며 실기기 저장 검증을 대신하지 않는다.
- 빌드 검증: `expo export --platform all`로 iOS/Android/Web production JS bundle 생성 성공(`/private/tmp/livetoeat-final-bundles`). Android `expo prebuild --platform android --no-install` 후 JDK17/로컬 SDK에서 `./gradlew app:assembleDebug` 성공(최종 2m15s, 529 tasks). APK는 `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`. `npm run build:share` 성공. production+체험 모드 설정 거부도 직접 실행해 확인했다. iOS는 Xcode 대신 CommandLineTools만 있어 네이티브 빌드/실행은 미검증이다.
- 브라우저 검증: 사용자가 허용한 예시 앱 화면으로 Ego에서 온보딩, 공개 지도→내 private/want 재저장, 메모·추천·방문 수정 후 새로고침 유지, 검색→새 장소 저장, 폴더 생성/이름 변경/삭제, 서울 6곳만의 공유 미리보기·개인 메모 제외·동의 후 초안 저장/관리 반영, 영어 전환, 320px/390px 화면을 확인했다. 공유 웹의 일러스트 CSS 충돌을 수정하고 잘못된 링크·만료 예시·상세 dialog/Escape 닫기를 확인했다. 캡처는 `/private/tmp/livetoeat-welcome.png`, `/private/tmp/livetoeat-explore-mobile.png`, `/private/tmp/livetoeat-profile-320-en.png`, `/private/tmp/livetoeat-share-fixed.png`에 있다.
- React Doctor: 변경 범위 82/100·경고 8개, 새 미추적 파일을 포함한 전체 범위 76/100·경고 20개. 두 범위 점수는 서로 직접 비교하지 않는다. 전체 검사 내 성능 이슈는 13→1개로 줄였으며 컴포넌트 복잡도/긴 화면/한정된 칩·사람 목록의 ScrollView 경고는 남아 있다. 도구의 loading 경고는 `finally` 안에서 요청 세대 확인 후 플래그를 내리는 부분도 포함한다. 진단 결과를 무경고로 주장하지 않는다.
- 출시 전 남음: 실제 OAuth/프로필 저장·동기화, 자체 장소 검색·네이버 지도·출처 표시, 지역 카탈로그·500개 실기기 성능, 서버 공유 생성/재발급/권한 재검사/웹 열람, 원본 공개 설명의 live 상세 조회, 신고·차단 서버/운영 지원/탈퇴와 내보내기 전체성, 법적 고지·지원 URL, Universal Links/App Links, VoiceOver/TalkBack·동적 글자 크기·실기기 키보드/파일 공유, Xcode 빌드, TestFlight/Play 테스트 및 소유자 승인 후 스토어 제출. 현재 상태를 실제 서비스 출시 완료로 간주하지 않는다.

### 2026-09-12 — 국내 지도·장소 데이터 조사

- 당시 요청/결정: 사용자가 국내 서비스를 명시하고 비용과 지속적인 장소 저장에 맞는 대안을 조사하도록 요청했다. 조사 당시 후보였던 구성은 2026-09-13에 확정했으며 실제 연동 전환은 아직 미완료다.
- 조사한 구성(2026-09-13 확정): 지도 표시는 네이버 Maps, 장소 검색·저장은 재사용 가능한 공공 상가정보를 적재한 자체 DB, 개인 메모·방문·폴더·공개범위는 사용자 기록으로 분리한다. 네이버/카카오 검색 응답을 복제해 자체 DB를 만드는 방안과 구분한다. 공공데이터에도 출처, 원본 식별자, 자료 기준일과 갱신 시각을 보존한다.
- 기본 데이터: [소상공인시장진흥공단 상가(상권)정보 CSV](https://www.data.go.kr/data/15083033/fileData.do)는 전국 영업 중 상가의 상호명·업종·지번/도로명주소·경도/위도를 제공하며, 공식 표시상 무료·이용허락범위 제한 없음이다. 확인한 최신 파일은 2026-06-30 기준, 2026-08-05 등록이며 분기 갱신이다. [동일 기관 API](https://www.data.go.kr/data/15012005/openapi.do)는 상가업소번호를 제공한다. 음식점·카페·제과 등 업종 필터와 원본 ID의 갱신 안정성은 실제 표본으로 검증해야 한다.
- 보완 데이터: [행정안전부 일반음식점 조회서비스](https://www.data.go.kr/data/15154916/openapi.do)는 전국 인허가 정보의 사업장명·주소·인허가일자·영업상태를 제공하며 무료·이용허락범위 제한 없음으로 표시한다. 상가정보와의 대응 관계를 검증한 후 신규/상태 변경의 보완 후보로 사용한다. 좌표계는 EPSG:5174이므로 지도용 위경도로 변환·검증해야 한다. 휴게음식점·제과점의 현행 전국 API와 실제 변경분 조회/갱신 지연은 추가 확인 대상이다.
- 지도 비용: [네이버 Maps 상품 안내](https://www.ncloud.com/api-cms/service-product/static/maps)와 [공식 요금표](https://m.ncloud.com/charge/price/ko)에서 Android/iOS/Web Dynamic Map의 대표 계정 1개당 월 6,000,000건 무료, 초과 건당 0.1원(VAT 별도)을 확인했다. 자체 DB에서 장소를 검색·재조회하면 외부 장소 API의 건별 검색·상세 호출이 필요하지 않지만 DB·서버·백업·데이터 갱신 운영비는 남는다. 과금 대상 지도 호출 수는 실제 SDK와 공유 웹에서 계측해야 한다.
- 앱 연결 가능성: [@mj-studio/react-native-naver-map 문서](https://rnnavermap.mjstudio.net/docs)는 New Architecture, Android/iOS와 Expo CNG/config plugin을 지원하고 Expo Go는 제외한다. 현재 Expo 57/RN 0.86.3에서의 호환성과 실제 타일·마커·클러스터·공유 웹은 아직 빌드/실행하지 않았다. 기존 지도 컴포넌트의 제공자 값만 바꾸는 작업으로 간주하지 않는다.
- 추천 이유: 자체 검색·저장 요구에서는 검색 API의 편의성보다 데이터 재사용 권한이 우선이다. 네이버는 국내 앱과 공유 웹의 지도 표시로, 소상공인시장진흥공단 데이터는 장기 저장 가능한 장소 정보의 기반으로 역할을 나눈다. 카카오 지도 표시도 대안이지만, [카카오 공식 운영진 답변](https://devtalk.kakao.com/t/local-api/151505)에 따른 검색 결과 저장 제한과 [ID 기반 재조회 API 부재](https://devtalk.kakao.com/t/api-id-place-url/151265/2)는 자체 장소 원본을 대신해 주지 않는다.
- 남은 품질 검증: 수도권·광역시·지방·제주의 음식점/카페/제과점 표본으로 검색 누락, 신규 매장 반영 지연, 중복/지점 구분, 폐업·이전, 좌표 오차를 측정한다. 소스 간 매칭은 이름만으로 자동 병합하지 않고, 원본에서 빠진 장소를 즉시 삭제하거나 폐업으로 단정하지 않는다. 이름 변경·폐업 이후에도 사용자의 저장과 개인 기록이 유지되도록 자체 장소 ID를 설계한다. 공공자료만으로 사진·메뉴·영업시간까지 확보했다고 주장하지 않는다.
- 이번 검증 범위: 공식 상품·요금·데이터 메타데이터·라이브러리 문서 조사다. CSV 전체 적재, 실제 데이터 표본 품질 측정, API 키 발급/활용신청, DB 변경, 네이티브 SDK 교체, 서버 실행과 Git 작업은 하지 않았다.

### 2026-09-13 — 국내 지도·자체 장소 DB 설계 확정 및 문서 전환

- 요청: 사용자가 최종 추천을 승인하고 기존 지도 전제를 문서에서 모두 제거한 뒤 확정한 플랜으로 업데이트하도록 요청했다.
- 변경: `AGENTS.md`, `README.md`, 상세 문서 01~05를 국내 서비스·네이버 Maps·공공데이터 자체 DB 기준으로 갱신했다. 자체 장소 UUID, 출처/기준일, 멱등 적재·갱신, 사용자 기록 보존, 자체 검색/상세/공유 계약, 내보내기와 출시 검증을 맞췄다.
- 범위: 문서만 변경했다. 기존 앱·서버·환경파일·lockfile·migration과 미추적 구현 파일은 보존했다. 자료 다운로드/적재, SDK 설치, DB 적용, 서버 실행, 실기기 실행, 외부 계정·프로덕션·Git 변경은 수행하지 않았다.
- 상태: 설계는 확정, 실제 전환은 NOT_STARTED다. 기존 인증·개인 기록·공유 공개범위와 로컬 체험의 검증 이력은 유지하며 새 연동 검증과 구분한다.
- 검증: Node 24.20.0 환경에서 `npm run check:docs` 통과(6개 파일의 상대 링크·요구사항 ID·비밀값 검사). README를 포함한 7개 Markdown의 UTF-8·코드블록·JSON 예시·상대 링크·참조 정의와 새 설계 포함을 추가 검사했고 이전 지도·장소 전제 검색은 0건이었다. 문서 대상 `git diff --check`도 통과했다. 작업 전후 비문서 tracked diff와 미추적 구현 파일의 내용 해시가 같아 기존 변경 보존을 확인했다. 문서 전용 변경이므로 앱/DB 테스트와 빌드는 실행하지 않았다.
- 다음: B02 국내 데이터 표본 품질과 네이버 지도 양 플랫폼/공유 웹 호환성 검증, 이후 B05/B07의 데이터·API 전환.

### 2026-09-13 — 기존 미커밋 구현 전체 검증과 Git Flow 반영

- 요청/범위: 문서만 반영한 뒤 남겨 둔 구현도 전부 커밋·푸시하고 develop에 통합하도록 사용자가 명시했다. 최신 develop 기반 `feature/app-experience-foundation`으로 이동했고 기존 변경 파일 65개의 내용 해시를 비교해 문서·앱 작업을 보존했다. 이미 반영한 문서 외 구현 58개 파일을 API/DB 기반, 공통 도메인, 모바일 경험·디자인, 공유 웹으로 구분했다.
- 포함: 지도 조회 한도와 공개 지도/재저장 migration·Edge 경계, 노트북 도메인·테스트, 앱 3개 탭·검색·편집·폴더·프로필·공유 초안·내보내기, 기기 저장과 체험 모드 경계, 디자인 자산·네이티브 설정, 공유 웹, 번역 검사와 기존 의존성 변경이다. 네이버 지도·공공자료 전환을 이번에 구현한 것은 아니다.
- 최소 수정: 별도 Deno 검사에서 일반 workspace 타입 검사에 포함되지 않던 Edge 오류 11건을 발견했다. 제네릭 `createClient` 자체의 반환 타입 대신 실제 서버 클라이언트 생성 함수의 반환 타입을 사용하고 선택적 환경값을 null로 정규화했다. 타입 검사는 수정 후 통과했으며 DB 계약과 API 동작은 확대하지 않았다.
- 기본 검증: Node 24.20.0/npm 11.17.0에서 `npm run check` 통과. lint 오류 0·기존 지도 기본 배열 경고 1건, workspace TypeScript, 단위 테스트 16건, 문서 검사와 한국어/영어 370키 검사가 통과했다. `npx --yes deno check --no-lock supabase/functions/app/index.ts`도 통과했다. 별도 서버 oxlint는 오류 0·루프 내 await 경고 3건이며 제한된 병렬 조회와 ticket 순차 발급 부분이다.
- 빌드: `npm run build:share`와 비밀값 없는 명시적 설정의 `expo export --platform all` 성공. 번들 위치는 `/private/tmp/livetoeat-prepush-bundles`다. 기존 Android 개발 프로젝트에서 JDK17과 SDK로 `./gradlew :app:assembleDebug --offline --no-daemon` 성공(25초, 529 tasks). iOS 네이티브 빌드/실기기·스토어 검증은 여전히 미완료다.
- React Doctor: 변경 범위 82/100·경고 8건, 미추적 신규 파일을 포함한 전체 76/100·경고 20건으로 이전 동일 범위 기록과 같다. 변경 범위 도구가 자동 선택한 비교 기준은 `origin/chore/initial-project-foundation`이며 develop 차이만 검사했다고 주장하지 않는다. 서로 다른 범위의 점수는 직접 비교하지 않는다.
- 검증 한계: `npm run test:db`는 로컬 PostgreSQL `127.0.0.1:54322` 연결 거부로 실패했고 Docker CLI도 없어 migration 적용·실제 RLS/동시성 테스트는 실행하지 못했다. Expo 로컬 의존성 표는 일치했으나 온라인 `expo install --check`는 새 Expo 57 패치 15개를 권고하며 종료 코드 1을 반환했다. 검증한 고정 버전을 임의로 일괄 변경하지 않았으며 후속 의존성 검토 대상으로 남긴다.
- 반영 경계: 자격 증명 패턴과 파일 목록을 검사했으며 로컬 환경파일·서명키·APK·빌드 출력은 커밋 대상에 포함하지 않는다. 실제 서버/DB 배포·외부 계정 설정·스토어 제출은 수행하지 않았다. 새 지도·자체 DB 전환과 실제 출시 완료 상태도 바꾸지 않는다.

### 2026-09-13 — B06 첫 진입·이메일 인증 화면

- 작업: B06 / R12,R17,R19. 앱을 열 때 토마토 브랜드 화면과 지도·음식 일러스트, 동작 줄이기를 존중하는 짧은 이동 애니메이션을 표시한다. 세션 확인이 길어지면 같은 화면을 유지한다.
- 인증 UI: 이메일·비밀번호 로그인, 이메일·비밀번호·비밀번호 확인 회원가입, 비밀번호 표시/숨김, 로컬 형식·8자·일치 검증, Google/Apple 진입, 가입 확인 메일 안내를 한국어/영어로 추가했다. 회원가입 뒤 기존 프로필 온보딩으로 이어지는 상태 계약을 유지한다.
- Supabase 경계: 설정된 공개 클라이언트의 `signInWithPassword`와 `signUp`만 앱에서 호출한다. service role/secret은 추가하지 않았다. 이메일 가입 확인이 켜져 세션이 없으면 확인 안내를 보여주고, 즉시 세션이 발급되면 계정 bootstrap으로 진행한다.
- 검증: Node 24.20.0에서 모바일 TypeScript와 번역 413키 검사가 통과했고, 전체 lint는 신규 오류 없이 기존 `MapCanvas` 기본 배열 경고 1건만 보고했다. 캐시를 비운 Expo 웹 production export가 통과했다. Ego 390px에서 `브랜드 로딩 → 로그인`, 회원가입 전환, 비밀번호 표시, 비밀번호 불일치 오류를 확인했고 320px에서도 가로 넘침 없이 내부 스크롤이 유지됐다.
- 한계/다음: 실제 Supabase 프로젝트의 이메일 provider·확인 정책·SMTP·Site URL을 아직 설정하거나 실계정으로 호출하지 않았다. 비밀번호 재설정과 확인 링크의 앱 복귀, Android/iOS 네이티브 키보드·스크린리더도 후속 B06 검증 대상이다. Ego 이미지 캡처는 도구 시간 초과, 시스템 UI 캡처는 권한 부재로 남아 이번 확인은 접근성 트리와 실제 DOM 치수·상태 전환을 사용했다.

### 2026-09-13 — B06 비밀번호 복구와 이메일 앱 링크

- 작업: B06 / R12,R17,R19. 로그인 화면에 비밀번호 찾기, 메일 발송 완료, 새 비밀번호 입력, 변경 완료와 재로그인 흐름을 한국어/영어로 추가했다. 가입 확인 메일도 앱의 전용 확인 경로로 돌아오게 했다.
- 앱 링크 경계: OAuth `auth/oauth`, 가입 확인 `auth/confirm`, 비밀번호 복구 `auth/recovery`를 분리했다. 이메일 링크는 저장된 PKCE verifier와 콜백을 연결하는 `sb_flow_id`만 허용하고, 예상 scheme/host/path가 아닌 링크와 오류·코드 누락 링크는 교환하지 않는다. 새 비밀번호 변경 뒤 복구 세션을 기기에서 지우고 다시 로그인하게 한다.
- Supabase 경계: 고정된 `@supabase/supabase-js`의 `resetPasswordForEmail`, `exchangeCodeForSession`, `PASSWORD_RECOVERY`, `updateUser` 공개 계약을 사용한다. 클라이언트에는 publishable key만 유지한다. 로컬 `config.toml`에는 개발 scheme의 세 경로와 PKCE query 패턴을 반영했다.
- 검증: 콜백 코드/flow id, 오류 fragment, 코드 누락, 유사 host·무관 경로 거부를 단위 테스트 4건으로 추가했다. `npm run check`에서 타입 검사, 문서·한영 436키 검사와 단위 테스트 20건이 통과했고 lint에는 기존 `MapCanvas` 기본 배열 경고 1건만 남았다. React Doctor 변경 범위 점수는 신규 인증 경고를 제거한 뒤 76/100이며 남은 20건은 기존 지도·장소·노트북 코드다. 비밀값 없는 설정의 `expo export --platform all`로 iOS/Android/Web 번들을 `/private/tmp/livetoeat-auth-recovery-final-bundles`에 생성했다. Ego에서 390px·320px 로그인/복구 폼 진입, 이메일 형식 오류, 로그인 복귀와 가로 넘침 부재를 확인했다.
- 한계/다음: hosted Supabase의 Redirect URL, email provider, custom SMTP와 메일 템플릿을 아직 설정하지 않았다. 실제 가입/복구 메일 전송, 만료·재사용 링크, cold/warm start, iOS Mail·Android 메일 앱 복귀와 새 비밀번호 로그인을 실제 개발 계정으로 검증해야 한다.

### 2026-09-13 — B06 프로필 온보딩

- 작업: B06 / R09,R12,R17,R19. 가입 뒤 표시 이름·고유 핸들을 정하고, 비공개 저장과 선택 공유 원칙·앱 언어·필수 동의를 확인하는 흐름을 한 화면의 긴 폼에서 2단계로 분리했다.
- UX: 입력과 동시에 공개 프로필 미리보기를 갱신하고, 핸들을 소문자로 정규화하며 형식 오류·중복 서버 오류를 첫 단계에서 수정하게 한다. 두 번째 단계의 언어 변경은 작성값을 유지하고, 이전 이동·로그아웃·키보드 회피·진행 상태·busy/disabled 접근성 상태를 제공한다.
- 검증: 모바일 TypeScript·lint와 한영 452키 검사가 통과했다. Ego에서 390px 프로필 입력·미리보기·단계 이동, 유효하지 않은 한글 핸들의 버튼 비활성화와 오류색, 언어 변경·동의 전후 완료 버튼 상태·이전 이동을 확인했다. 320px 양 단계에서 가로 넘침 없이 모든 조작이 접근성 트리에 노출됐다.
- 한계/다음: 실제 핸들 중복 응답과 `complete_onboarding` RPC 성공, 재시작 뒤 프로필·언어 유지, 네이티브 키보드·VoiceOver·TalkBack은 Supabase 개발 환경과 양 플랫폼 빌드에서 검증해야 한다. 공개 이용약관·개인정보 문서의 URL과 실제 버전을 확정해 현재 개발용 RPC 버전을 교체해야 한다.

## 공식 근거

[D1]: https://rnnavermap.mjstudio.net/docs
