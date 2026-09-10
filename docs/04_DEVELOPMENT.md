# 04. 개발계획, 실행 지침과 진행 기록

버전 2.1 | 2026-09-11 | 단일 개발 진행 문서

## 1. 개발 원칙

LiveToEat은 React Native + Expo로 만드는 iOS/Android 앱이며, 공유 링크 열람만 작은 웹 화면으로 제공한다. npm workspaces와 루트 `package-lock.json` 하나를 사용하고, TypeScript strict·런타임 입력 검증·번역 키·제공자 DTO와 사용자 데이터 분리를 기본으로 한다.

각 작업은 관련 요구사항, 변경 파일, migration 여부, 실제 실행 명령과 검증 상태를 이 문서에 기록한다. 외부 키·계정·결제·도메인이 없어서 실행하지 못한 기능은 완료라고 쓰지 않는다. 비밀값은 소스·로그·채팅에 넣지 않는다.

Google Maps는 지도 표시와 Places 검색 제공자다. 장소 입력은 사용자가 검색 결과에서 직접 선택하는 흐름으로 한정한다.

## 2. 도구와 환경

로컬은 지원 Node LTS/npm, Git, Android Studio/JDK, Docker/Supabase CLI를 준비한다. iOS 로컬 빌드와 시뮬레이터는 macOS/Xcode가 필요하며, 클라우드 빌드는 실기기 확인을 대체하지 않는다.

development/preview/production은 앱 식별자, Supabase 설정, Google API 키, EAS channel을 분리한다. 개발 앱이 production DB를 기본값으로 쓰지 않으며, 지도 키와 서버 Places 키를 분리한다.

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

설치 예시:

```bash
npm install
cd apps/mobile
npx expo install react-native-maps expo-dev-client expo-location expo-secure-store \
  expo-sharing expo-linking expo-web-browser expo-auth-session \
  expo-apple-authentication expo-crypto expo-localization --npm
npx expo install --check
npx expo-doctor
```

개발 중에는 `npm install`, CI에서는 `npm ci`를 사용한다. Supabase CLI/EAS CLI/Firebase CLI는 devDependency 버전을 고정한다.

## 3. 환경변수와 지도 설정

모바일 공개·빌드 구성 예시는 다음과 같다.

```dotenv
APP_VARIANT=development
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
EXPO_PUBLIC_SHARE_ORIGIN=https://example.invalid
APP_IOS_BUNDLE_ID=com.ddoni.livetoeat.dev
APP_ANDROID_PACKAGE=com.ddoni.livetoeat.dev
APP_SCHEME=live-to-eat-dev
GOOGLE_MAPS_IOS_KEY=YOUR_RESTRICTED_IOS_MAPS_KEY
GOOGLE_MAPS_ANDROID_KEY=YOUR_RESTRICTED_ANDROID_MAPS_KEY
```

서버 전용 값은 `GOOGLE_PLACES_SERVER_KEY`, Supabase service role/secret, OAuth client secret, Apple .p8와 철회 토큰 암호화 키다. mobile/share의 env 예시에 원문을 넣지 않는다. Google 네이티브 지도 키는 bundle/package와 서명 인증서 및 허용 API로 제한하고, Places 키는 서버 런타임에만 둔다. [D1][D2]

`app.config.ts`는 `APP_SCHEME`, iOS bundle ID, Android package, 양 플랫폼의 Google Maps 키를 필수 환경값으로 읽는다. config plugin이나 native 의존성을 바꾸면 OTA가 아니라 새 development/preview/store binary를 만들어야 한다.

## 4. 단계별 작업과 인수 기준

| 단계/작업 ID | 개발 내용 | 완료 증거 | 요구사항 |
|---|---|---|---|
| M0 / B01 | 기존 저장소 확인, RN/Expo/Node/지도 호환 버전 고정, npm workspace | lockfile/버전표, iOS/Android dev build 생성 | R20 |
| M0 / B02 | Google 지도/Places 비용·제한·양 플랫폼 렌더링 spike | dev와 store-signed 키 검증 계획, 장소 10개 검색/표시, 호출 계측 | R02,R17 |
| M1 / B05 | Supabase migration, RLS, 제한 RPC, 지역 카탈로그 | 빈 DB 재생성, 타 계정 접근 거부 SQL 테스트 | R07,R09 |
| M1 / B06 | Google/Apple 인증, 프로필/언어/온보딩/세션 | 실제 계정 로그인/재실행/로그아웃/교차 플랫폼 확인 | R12,R19 |
| M2 / B07 | 검색/저장/편집/중복/개인 폴더 | 검색→저장→앱 종료→내 기록 확인 E2E | R01,R02,R03 |
| M2 / B08 | 내 지도/목록/지역/클러스터/좌표 미확인 | 위치 거부, 500개 합성 기록, 점진 표시, 날짜변경선 테스트 | R01,R07,R17,R19 |
| M4 / B12 | 공개 지도/둘러보기/타인 저장 | A 공개→B 발견→B private 저장, 비공개 누출 없음 | R04,R05,R06 |
| M4 / B13 | 지역 공유 생성/만료/철회/epoch | 허용 장소만 표시, private 복귀 후 옛 링크 부활 없음 | R08,R09,R10 |
| M4 / B14 | 작은 웹/자체 도메인/AASA/App Links | 미설치 iOS/Android 브라우저 지도 열람, 설치 앱 이동 | R11,R19 |
| M5 / B15 | 신고/차단/운영 숨김, 문의, 내보내기, 탈퇴 | 실제 처리 경로, Apple 철회/삭제 재시도/복원 검사 | R16,R18,R12 |
| M5 / B16 | 비용/성능/접근성/개인정보/릴리스 점검 | 05의 정의된 테스트 증거와 해결된 blocker | R17,R18,R19,R20 |
| M6 / B17 | TestFlight/Play 테스트, 수정, 스토어 제출 | 실제 테스트 빌드 ID, 테스트 결과, 제출 상태 | R20 |
| M6 / B18 | 스토어 승인/국가 선택/단계 배포/운영 검증 | 양 스토어 공개 URL, 삭제/신고/장애 대응 실사용 확인 | R20 |

국제화는 마지막 번역 작업이 아니다. B05부터 지역 스키마, B06부터 번역 키, B08부터 국제 좌표를 반영한다. 작은 공유 웹은 앱을 대체하는 첫 제품이 아니라 앱이 없는 사람의 공유 열람을 위한 제한된 범위다.

## 5. 검증 규칙

일반적으로 작업 전후에 관련 lint/typecheck/unit을 실행하고, DB 변경은 로컬 SQL 테스트, native 변경은 해당 플랫폼 빌드에서 검증한다. 다만 사용자가 이번 작업처럼 검증 실행을 보류하라고 하면 실행하지 않고 미실행으로 기록한다.

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
| 문서 패키지 | 갱신됨 | 지도·장소 검색·국제 지역 중심으로 정리 |
| Expo/RN/지도/Node exact version | 선정/검증 | lockfile 고정, 이전 Expo Doctor와 의존성 검사 통과 기록 |
| iOS/Android build | PARTIAL | Android debug APK 빌드 성공 기록. iOS JS bundle 성공, 네이티브 빌드는 Xcode 미설치로 BLOCKED |
| 앱 지도 화면과 Google provider | PARTIAL | Android JS bundle에 `react-native-maps` Google provider 포함. 실제 타일 렌더링은 제한된 키와 실기기 검증 전 BLOCKED |
| 실제 Google Places 호출 | NOT_STARTED | 소유자 승인/키/쿼터 후 B02/B07 |
| Supabase migration/RLS (B05) | PARTIAL | 계정 상태·개인 저장·국제 지역 카탈로그 migration/RLS/제한 상태 RPC를 작성했다. `npm run test:db`는 로컬 Postgres 미실행으로 `127.0.0.1:54322` 연결이 거부됐고, Docker CLI도 없어 migration/RLS SQL 검증까지 진행하지 못했다 |
| Google/Apple 인증·온보딩·세션 (B06) | PARTIAL | 제한 RPC와 모바일 인증 흐름을 작성했다. Supabase/provider·Apple 식별자 설정, 로컬 DB 적용, 실제 계정 검증이 남았다 |
| 장소 검색·비공개 저장 기반 (B07) | PARTIAL | 검색→확인→비공개 저장, 개인 폴더, 개인 기록 수정/삭제 UI와 Edge/RPC source를 추가했다. DB 적용·Edge 배포·실계정 확인은 미실행 |
| 외부 목록·링크 입력 | 제거됨 | 장소 입력을 검색으로 단순화하고, 기존 개인 저장을 보존하는 cleanup migration을 추가 |
| 기능 구현 B08, B12~B16 | NOT_STARTED | 단계별 진행 |
| 스토어 계정/인증서/도메인 | OWNER_SETUP_REQUIRED | 소유자 명의로 설정 |
| 베타/심사/공개 출시 | NOT_STARTED | M6, 승인과 공개를 별도 기록 |

버전 기록 슬롯: Node=24.20.0 / npm=11.17.0 / Expo=57.0.21 / React Native=0.86.3 / react-native-maps=1.27.2 / iOS 최소 OS=16.4 / Android minSdk=24 / targetSdk=36 / EAS build image=미정.

## 7. 결정 기록

| 날짜 | 결정 | 이유 |
|---|---|---|
| 2026-09-09 | 웹 우선 대신 React Native 앱 출시 | 사용자 명시 방향 |
| 2026-09-09 | Google Maps/Places, 글로벌 지역 모델 | 사용자 국제 서비스 방향 |
| 2026-09-09 | 개인 폴더 P0 | 내 저장을 원하는 방식으로 분류 |
| 2026-09-09 | 작은 공유 웹 P0 | 앱 미설치자의 지역 공유 열람 유지 |
| 2026-09-09 | Google 좌표 DB 캐시는 기본 비활성 | 저장/백업 수명 확인 후 허용 범위에서 활성화 |
| 2026-09-09 | 제품명 `LiveToEat`, 저장소/패키지명 `live-to-eat` | 사용자 지정 |
| 2026-09-09 | 공유 웹은 Vite + React로 구성 | 앱 미설치 열람에 필요한 작은 정적 웹 범위 유지 |
| 2026-09-10 | B06의 계정 초기화·온보딩은 제한 RPC로만 허용 | 인증된 사용자가 자기 `auth.uid()`에 대해서만 onboarding→active 전환 |
| 2026-09-10 | 첫 실행 UI 언어는 한국어 | 인증 전·미리보기의 기본 `lng`는 `ko`, 활성 계정의 선택은 계속 우선 |
| 2026-09-10 | Places 검색 결과는 짧은 수명의 서버 발급 ticket으로만 저장 전환 | 모바일은 Google Places 키·Place ID를 직접 다루지 않고, 검색 표시용 Google 콘텐츠는 저장하지 않음 |
| 2026-09-10 | 장소 입력 경로 단순화 | 외부 목록·링크·공유 수신의 임시 처리 기능을 제거하고 지도 표시와 Places 검색은 유지 |

## 8. 문서 패키지 QA

문서 변경 뒤 파일 수, UTF-8 인코딩, 상대 링크, 코드블록, 예시 문법, 비밀키 포함 여부를 검사한다. 이 검사는 앱·SQL·스토어 기능 테스트와 다르다.

이번 범위에서는 `npm run check`를 실행해 lint, TypeScript, 단위 테스트 2건, 문서 검사를 통과했다. 변경 범위 React Doctor는 기존 장소 관리 화면의 경고 9건을 보고했지만 이번 변경 줄의 새 경고는 보고하지 않았고, 도구 내부 유지보수 검사 실패로 점수는 산출하지 못했다. `npm run test:db`는 로컬 Postgres가 실행 중이지 않아 `127.0.0.1:54322` 연결이 거부됐으며, Docker CLI도 사용할 수 없었다. Supabase local start/reset·migration apply, Edge 배포, Expo 실행과 실제 Google API 호출은 실행하지 않았다. 새로운 cleanup migration의 DB 적용·RLS 및 기존 저장 보존은 로컬 Supabase 환경을 준비한 뒤 별도로 검증해야 한다.

## 9. 작업 기록

### 2026-09-09 — B01 기반 설정

- 작업: B01 / R20
- 변경: npm workspaces 루트, Expo Development Build 모바일 앱, Vite 공유 웹, 공통 도메인 패키지, Supabase 로컬 디렉터리와 환경변수 예시를 생성했다.
- 검증: 이전 기록상 lint/typecheck/문서 검사와 단위 테스트, Expo Doctor, 양 플랫폼 JS bundle, 공유 웹 build, Android debug APK가 성공했다. 실제 지도 타일은 제한된 키를 설정한 뒤 검증해야 한다.
- 남은 것: Xcode, 제한된 Google Maps/Places 키, Docker 기반 Supabase 테스트, 실제 기기 검증이 필요하다.

### 2026-09-09 — B02 지도 화면과 Google provider

- 작업: B02 / R02, R17
- 변경: iOS/Android 모두 `PROVIDER_GOOGLE`로 렌더링하는 내 지도 화면을 추가했다. 현재 위치 권한 없이 전 세계 초기 범위를 보여 주며, 내 저장만 표시한다.
- 검증: 이전 기록상 Android Expo export와 lint/typecheck가 통과했다. 실제 지도 렌더링은 키·실기기 검증 전이다.
- 남은 것: 제한된 키를 설정한 iOS/Android 실기기에서 지도 타일과 attribution을 확인하고 Places 호출 계측을 한다.

### 2026-09-10 — B05~B07 저장 기반

- 작업: B05, B06, B07 / R01,R02,R03,R07,R09,R12,R19
- 변경: 계정 상태·국제 지역·개인 저장·개인 폴더 migration/RLS/RPC, Google/Apple 로그인과 온보딩, Places 검색 ticket 및 private 저장 UI/Edge 경계를 추가했다.
- 검증: migration 적용, RLS SQL, Edge 배포, 실제 계정과 Google Places 호출은 미실행이다.
- 남은 것: 개발 Supabase·provider·키를 소유자가 설정한 뒤 실제 계정으로 검색·저장·재실행·수정/삭제를 검증한다.

### 2026-09-11 — 외부 장소 입력 흐름 제거

- 작업: 범위 변경
- 변경: 파일 파서·파일 선택·행 검토·batch RPC, 링크 붙여넣기·OS 공유 inbox·네이티브 share module을 제거했다. Domain 계약·로케일·앱 설정·문서를 지도 표시와 Places 검색만 남도록 갱신했다. 새 Supabase cleanup migration은 임시 테이블과 전용 RPC·ticket 보조 컬럼을 제거한다.
- 실행: `npm run check`와 변경 범위 React Doctor를 실행했다. `npm run test:db`도 실행했지만 로컬 Postgres가 실행되지 않아 `127.0.0.1:54322` 연결이 거부됐고 Docker CLI도 사용할 수 없었다. DB migration apply, Expo 실행과 실제 API 호출은 실행하지 않았다.
- 검증: lint, TypeScript, 단위 테스트 2건과 문서 검사는 통과했다. React Doctor는 이번 변경 줄의 새 경고 없이 기존 장소 관리 화면의 경고 9건을 보고했으며, 점수는 도구 내부 유지보수 검사 실패로 산출하지 못했다. cleanup migration 적용 후 기존 개인 저장이 보존되고 제거 대상 전용 리소스만 사라지는지는 로컬 Supabase에서 확인해야 한다.
- 정책/비용: Google Maps 지도 SDK와 Google Places 검색은 유지한다. 장소 입력은 검색 결과를 직접 선택하는 방식으로 한정한다.

## 공식 근거

[D1]: https://developers.google.com/maps/api-security-best-practices
[D2]: https://docs.expo.dev/versions/latest/sdk/map-view/
