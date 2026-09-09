# 04. 개발계획, 실행 지침과 진행 기록

버전 2.0 | 2026-09-09 | 단일 개발 진행 문서

## 1. 이 패키지를 저장소에 적용하는 방법

새 패키지는 `AGENTS.md + docs 안의 MD 5개`다. 코드/DB migration/배포 설정이 들어 있는 완성 앱이 아니다. 아래 명령과 설정은 Codex가 프로젝트를 생성하면서 구현할 계약이다.

기존 저장소가 있다면 먼저 git 상태와 코드를 확인한다. 기존 Next.js 코드를 자동 삭제하지 않는다. 변경 전 commit을 만들고, 아래 통합 대상인 이전 생성 문서만 교체한다. 사용자가 따로 작성한 docs까지 glob으로 지우지 않는다. 오래된 문서를 같은 활성 docs 안에 남겨 Codex가 서로 다른 지침을 읽게 하지 않는다.

| 새 문서 | 통합한 이전 영역 |
|---|---|
| AGENTS.md | 제품 핵심/필수 기술 경계/읽는 순서 |
| 01_PRODUCT.md | PRODUCT_SPEC, UX_SPEC, METRICS_AND_BUSINESS의 제품 가설 |
| 02_ARCHITECTURE.md | ARCHITECTURE, DATABASE, API_CONTRACT, SECURITY_AND_PRIVACY의 구현 규칙 |
| 03_MAPS_AND_IMPORT.md | MAPS_AND_REGIONS, PLACE_DATA_POLICY, IMPORT_EXPORT |
| 04_DEVELOPMENT.md | DEVELOPMENT_GUIDE, IMPLEMENTATION_PLAN, CODEX_START, PROGRESS, DECISIONS, DOCUMENT_QA |
| 05_RELEASE.md | TEST_PLAN, OPERATIONS, LAUNCH_CHECKLIST, 운영 지표/보호 정책 |

루트 `README.md`는 제품을 처음 보는 사람을 위한 짧은 소개와 상세 문서의 진입점으로 둔다. 요구사항, 공식 근거, 구현 지침의 원문은 중복하지 않고 이 문서 패키지를 기준으로 한다. SOURCES/각종 템플릿의 독립 MD는 제거하고 안내, 공식 근거, 예시를 해당 문서에 포함했다. 기존 카카오/네이버 문의 템플릿과 한국 공공 상권데이터 적재 설계는 이번 Google 국제 버전의 필수 경로가 아니다. 사용자 기록의 import와 전 세계 장소 DB 수집을 혼동하지 않는다.

## 2. 기본 개발 원칙

각 작업은 요구사항 ID, 변경 파일, migration 여부, 테스트, 실제 검증 상태를 가진다. 기능 하나를 UI부터 DB/권한/오류까지 연결한 뒤 다음 기능으로 간다. 설정되지 않은 외부 계정 때문에 UI 목업만 성공한 것을 완료로 표시하지 않는다.

비밀키/과금/계정/도메인이 필요하면 필요한 변수명과 소유자 작업을 기록한다. 자격증명을 요청할 때 채팅/소스에 원문을 붙이도록 하지 않는다. 미설정 작업은 BLOCKED로 남기되 독립적으로 가능한 로컬 구현/테스트를 이어간다.

npm만 사용한다. npm workspaces의 루트 lockfile 한 개를 유지한다. Expo/React Native 관련 네이티브 패키지는 Expo 지원 버전으로 설치한다. `latest`를 매번 다시 설치하는 재현 불가능한 CI를 만들지 않는다. 초기 scaffold만 최신 안정 지원 버전을 조사하고 이후 exact version/lockfile을 유지한다.

TypeScript strict, 런타임 입력 검증, 일관된 오류 코드, 문자열 번역 키, provider DTO와 자체 데이터 타입 분리를 기본으로 한다. UI 컴포넌트에서 Google Places 키나 관리자 쿼리를 직접 사용하지 않는다.

## 3. 도구와 환경

로컬은 지원되는 Node LTS/npm, Git, Android Studio/JDK, Docker/Supabase CLI를 준비한다. iOS 로컬 빌드/시뮬레이터는 macOS/Xcode 환경에서 검증하고, 클라우드 빌드도 서명/계정/실기기 확인을 대체하지 않는다.

각각 별도 development/preview/production 앱 식별자, Supabase 프로젝트/설정, Google API 키와 EAS channel을 둔다. 개발 앱에서 프로덕션 DB를 기본값으로 쓰지 않는다. 테스트 기기에서 preview와 production을 동시에 설치해 키/링크 섞임을 확인한다.

최초 bootstrap은 기존 파일이 있는 루트에서 scaffold 명령을 덮어 실행하지 않는다. 공식 create-expo-app 도움말로 현재 옵션을 확인하고 임시 빈 폴더에서 생성한 뒤 `apps/mobile`로 필요한 파일만 옮겨 npm workspace를 구성한다. [D1]

필수 root scripts 계약:

| 명령 | 실제로 실행할 작업 |
|---|---|
| `npm run dev:mobile` | mobile workspace에서 Expo dev client 시작 |
| `npm run dev:share` | 작은 공유 웹 개발 서버 |
| `npm run lint` | 앱/공통/웹/서버의 해당 lint |
| `npm run typecheck` | 앱/웹/공통 타입 및 Edge 별도 타입 검사 |
| `npm run test:unit` | 도메인/파서/컴포넌트 테스트 |
| `npm run test:db` | 로컬 Supabase의 SQL/RLS/트랜잭션 테스트 |
| `npm run test:e2e` | 준비된 실제 앱/시뮬레이터 대상 E2E |
| `npm run build:share` | 공유 웹 production bundle |
| `npm run check` | lint, typecheck, unit, 문서 참조 검사. DB/E2E는 별도 선행 환경 명시 |

설치 예시(프로젝트 생성과 workspace 설정 후):

```bash
npm install
cd apps/mobile
npx expo install react-native-maps expo-dev-client expo-location expo-secure-store \
  expo-document-picker expo-file-system expo-sharing expo-linking expo-web-browser \
  expo-auth-session expo-apple-authentication expo-crypto expo-localization --npm
npx expo install --check
npx expo-doctor
```

`npm install`은 개발 중 lockfile 변경, CI는 `npm ci`. Supabase CLI/EAS CLI/Firebase CLI는 devDependency 버전을 고정한다. Edge Functions의 Deno 런타임은 패키지 관리자를 변경한다는 뜻이 아니며 서버 의존성도 별도로 고정/검사한다.

## 4. 환경변수와 지도 설정 예시

mobile `.env.example`에 들어갈 공개/빌드 구성 예:

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

앱 번들에는 공개 publishable key가 들어가므로 보안은 RLS/권한으로 보장한다. Google 네이티브 지도 키도 바이너리에서 추출될 수 있다. `EXPO_PUBLIC_`가 없다는 이유만으로 빌드에 들어간 값을 비밀이라고 부르지 않는다. [D2][D3]

서버 비밀은 별도다: GOOGLE_PLACES_SERVER_KEY, Supabase service role/secret, OAuth client secrets, Apple .p8/철회용 토큰 암호화 키. mobile/share의 env 예시에 원문을 넣지 않는다. Supabase 관리 secret은 현재 배포 런타임의 실제 이름/권한을 확인한다.

share workspace의 VITE_*에는 웹용 Google Maps JS 제한 키, 공개 서버 origin만 둔다. 웹 키는 HTTP referrer/API 제한, iOS 키는 bundle ID, Android 키는 package+서명 인증서 SHA-1, 서버 키는 서버용 허용 API와 가능한 출처 제한을 적용한다. Supabase Edge의 고정 egress IP를 있다고 가정하지 말고 서버키 노출 방지/별도 프로젝트/쿼터와 필요 시 고정 egress 대안을 검토한다. [D3]

app.config.ts의 지도 관련 최소 발췌(전체 설정이 아니며 기존 config를 보존):

```ts
import type { ConfigContext, ExpoConfig } from 'expo/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing configuration: ${name}`);
  return value;
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'LiveToEat',
  slug: config.slug ?? 'live-to-eat',
  scheme: required('APP_SCHEME'),
  ios: { ...config.ios, bundleIdentifier: required('APP_IOS_BUNDLE_ID') },
  android: { ...config.android, package: required('APP_ANDROID_PACKAGE') },
  plugins: [
    ...(config.plugins ?? []),
    ['react-native-maps', {
      iosGoogleMapsApiKey: required('GOOGLE_MAPS_IOS_KEY'),
      androidGoogleMapsApiKey: required('GOOGLE_MAPS_ANDROID_KEY'),
    }],
  ],
});
```

같은 plugin을 중복 등록하지 않는다. JSON 문자열에 `process.env.KEY`를 써 넣는 것이 아니라 TypeScript에서 실제 환경변수를 평가한다. Google SDK 활성화/과금 계정/키 제한과 별개로 Google Places API (New)를 서버 프로젝트에서 활성화해야 한다. [D4]

```tsx
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';

// 실제 화면에서는 bounds, 접근성, 오류/목록 대체 UI를 함께 구현한다.
<MapView provider={PROVIDER_GOOGLE} style={{ flex: 1 }} />;
```

config plugin/네이티브 의존성/앱 권한 변경은 새 binary가 필요하다. OTA로 native 설정을 바꿀 수 있다고 가정하지 않는다. CNG로 native 생성물을 반복 생성해도 같은 설정이 적용되어야 한다. 키 이름만 바꾸고 재빌드 없이 검증 완료로 표시하지 않는다.

## 5. 단계별 작업과 인수 기준

| 단계/작업 ID | 개발 내용 | 완료 증거 | 요구사항 |
|---|---|---|---|
| M0 / B01 | 기존 저장소 확인, RN/Expo/Node/지도 호환 버전 고정, npm workspace | lockfile/버전표, iOS/Android dev build 생성 | R20 |
| M0 / B02 | Google 지도/Places 비용/제한/실제 양 플랫폼 렌더링 spike | dev와 store-signed 키 검증 계획, 장소 10개 검색/표시, 호출 계측 | R02,R17 |
| M0 / B03 | Takeout 실제 샘플/법적 필드 구분/파서 prototype | 민감값 제거 fixture, 구체 헤더/목록/좌표 유무/매칭 결과 | R13,R15 |
| M0 / B04 | iOS Share Extension 및 Android 수신/앱 링크 spike | 자동 main-app 실행 우회 없이 링크 수신/중복 제거 영상 | R14 |
| M1 / B05 | Supabase migration, RLS, 제한 RPC, 지역 카탈로그 | 빈 DB 재생성, 타 계정 접근 거부 SQL 테스트 | R07,R09 |
| M1 / B06 | Google/Apple 인증, 프로필/언어/온보딩/세션 | 실제 계정 로그인/재실행/로그아웃/교차 플랫폼 확인 | R12,R19 |
| M2 / B07 | 검색/저장/편집/중복/개인 폴더 | 검색→저장→앱 종료→내 기록 확인 E2E | R01,R02,R03,R15 |
| M2 / B08 | 내 지도/목록/지역/클러스터/좌표 미확인 | 위치 거부, 500개 합성 기록, 점진 표시, 날짜변경선 테스트 | R01,R07,R17,R19 |
| M3 / B09 | ZIP/CSV 선택/검증/파싱/목록 미리보기 | 큰 파일/악성 압축/메타데이터행/다국어 fixture 통과 | R13,R15 |
| M3 / B10 | 후보 매칭/지역 지정/commit/중단 재시도 | 200행 중복 포함 가져오기, 행별 결과, 메모 보존 | R13,R15 |
| M3 / B11 | 링크 붙여넣기/수신 inbox 완성 | 앱 종료/실행 중/로그아웃 상태에서 저장 확인 | R14 |
| M4 / B12 | 공개 지도/둘러보기/타인 저장 | A 공개→B 발견→B private 저장, 비공개 누출 없음 | R04,R05,R06 |
| M4 / B13 | 지역 공유 생성/만료/철회/epoch | 허용 장소만 표시, private 복귀 후 옛 링크 부활 없음 | R08,R09,R10 |
| M4 / B14 | 작은 웹/자체 도메인/AASA/App Links | 미설치 iOS/Android 브라우저 지도 열람, 설치 앱 이동 | R11,R19 |
| M5 / B15 | 신고/차단/운영 숨김, 문의, 내보내기, 탈퇴 | 실제 처리 경로, Apple 철회/삭제 재시도/복원 검사 | R16,R18,R12 |
| M5 / B16 | 비용/성능/접근성/개인정보/릴리스 점검 | 05의 T01~T16 증거와 해결된 blocker | R17,R18,R19,R20 |
| M6 / B17 | TestFlight/Play 테스트, 수정, 스토어 제출 | 실제 테스트 빌드 ID, 테스트 결과, 제출 상태 | R20 |
| M6 / B18 | 스토어 승인/국가 선택/단계 배포/운영 검증 | 양 스토어 공개 URL, 삭제/신고/장애 대응 실사용 확인 | R20 |

M0를 완료하기 전 전체 화면을 한꺼번에 만들지 않는다. 특히 실제 Takeout이 어떤 형태인지 확인하지 않은 채 `목록 자동 이전 완료` 문구부터 만들지 않는다. B03의 검증에 실패한 포맷은 별도 unsupported 상태로 처리하고 출시 설명을 수정한다.

국제화는 마지막 번역 작업이 아니다. B05부터 지역 스키마, B06부터 번역 키, B08부터 국제 좌표를 반영한다. 작은 공유 웹은 앱을 대체하는 첫 제품이 아니라 R11의 완료 조건이다.

## 6. 개발 완료 기준과 검증 규칙

각 작업에서 lint/typecheck/unit을 통과하고, DB 작업은 실제 SQL 테스트, native 작업은 실제 해당 플랫폼 빌드에서 검증한다. mock provider로 테스트했다면 mock이라고 쓴다. API key 없이 지도 컨테이너만 뜬 것은 지도 검증이 아니다.

DB migration은 로컬 reset부터 clean apply를 검증한다. 프로덕션에 로컬 seed를 넣지 않는다. schema 변경은 이전 앱 버전과의 호환을 유지하는 expand→migrate→contract 순서로 한다. 이미 설치된 구버전 앱을 강제로 동시에 업데이트할 수 없다는 전제다.

PR/작업 마무리 기록 형식(이 문서에 누적):

```text
작업: Bxx / 관련 Rxx
변경: 경로와 주요 변경
실행: 실제 실행한 명령/플랫폼/환경
검증: 성공/실패/미실행과 증거 위치
정책/비용: 변경 유무
남은 것: blocker와 다음 작업
```

## 7. Codex 시작 프롬프트

```text
AGENTS.md와 docs/01_PRODUCT.md, docs/04_DEVELOPMENT.md를 먼저 읽어라.
이 저장소는 React Native + Expo로 iOS/Android 스토어 출시까지 진행하는
국제 맛집 저장/공유 앱이다. npm과 Supabase, 양 플랫폼 Google Maps를 사용한다.

기존 파일과 git 상태를 확인하고 안전하게 보존하라. Next.js 앱을 만들지 말라.
상세 구현 규칙은 02, Google 정책/가져오기는 03, 테스트/출시는 05를 따른다.

먼저 M0의 B01~B04를 작은 검증 단위로 진행하라. 실제 사용 가능한 안정 버전과
호환 조합을 기록하고, 지도 provider를 iOS에서도 Google로 명시하라.
Google 로그인과 저장목록 이전 권한을 혼동하지 말라.
Takeout 파서, 다국어/지역 구조, iOS의 정상 공유 확장을 검증하라.

키/계정/결제/실기기가 없으면 필요한 설정과 blocked 이유를 기록하고,
실행 가능한 로컬 코드와 합성 데이터 테스트는 이어가라.
실제 API나 빌드를 실행하지 않았으면 성공이라고 쓰지 말라.
프로덕션 변경/유료 자원 생성/스토어 제출은 소유자 승인 후 실행하라.

각 작업 뒤 변경 파일, 실행 결과, 미완료 사항을 보고하고 이 문서의 상태표를
갱신하라. 불필요한 새 MD 문서는 만들지 말라.
```

## 8. 현재 상태

이 표는 개발을 실행할 때 갱신한다. 설계 문서 작성과 제품 구현은 별도다.

| 항목 | 현재 상태 | 증거/다음 행동 |
|---|---|---|
| 6개 통합 문서 작성 | 작성됨 | 이 패키지 |
| 기존 문서의 핵심 제품 요구 검토 | 완료 | 공개범위/지역 공유/개인 기록/탈퇴 등 유지, 국제 RN으로 변경 |
| 공식 SDK/API/스토어 정책 조사 | 확인함 | 각 문서 공식 링크, 2026-09-09 |
| 실제 저장소/기존 코드 조사 | 완료 | 기존 `live-to-eat` 프로젝트가 없음을 확인하고 신규 workspace 구성 |
| Expo/RN/지도/Node exact version | 선정/검증 | lockfile 고정, Expo Doctor 21/21 및 Expo 의존성 검사 통과 |
| iOS/Android build | PARTIAL | Android debug APK 빌드 성공. iOS JS bundle 성공, 네이티브 빌드는 Xcode 미설치로 BLOCKED |
| 앱 지도 화면과 Google provider | PARTIAL | Android JS bundle에 `react-native-maps` Google provider 포함. 실제 타일 렌더링은 제한된 네이티브 키와 실기기 검증 전 BLOCKED |
| 실제 Google Places 호출 | NOT_STARTED | 소유자 승인/키/쿼터 후 M0 |
| 실제 Takeout 내보내기/파싱 | PARTIAL | 합성 CSV의 헤더·BOM·따옴표·줄바꿈·오류 파서는 검증. 본인 동의한 실제 비식별 fixture가 필요 |
| 공유 링크 수신 inbox (B04) | PARTIAL | Android `ACTION_SEND` 수신 Activity와 7일·20개 한도 inbox는 debug APK까지 컴파일. iOS Share Extension/App Group CNG 생성과 모듈 autolinking은 확인했으나 Xcode·실기기 빌드는 BLOCKED |
| Supabase migration/RLS | NOT_STARTED | M1 |
| 기능 구현 B05~B16 | NOT_STARTED | 단계별 진행 |
| 스토어 계정/인증서/도메인 | OWNER_SETUP_REQUIRED | 소유자 명의로 설정 |
| 베타/심사/공개 출시 | NOT_STARTED | M6, 승인과 공개를 별도 기록 |

버전 기록 슬롯: Node=24.20.0 / npm=11.17.0 / Expo=57.0.21 / React Native=0.86.3 / react-native-maps=1.27.2 / iOS 최소 OS=16.4 / Android minSdk=24 / targetSdk=36 / EAS build image=미정.

## 9. 결정 기록

| 날짜 | 결정 | 이유 |
|---|---|---|
| 2026-09-09 | 웹 우선 대신 React Native 앱 출시 | 사용자 명시 방향 |
| 2026-09-09 | Google Maps/Places, 글로벌 지역 모델 | 사용자 국제 서비스 방향 |
| 2026-09-09 | 원래 28개 파일을 MD 6개로 통합 | 핵심 설명은 root, 상세는 docs |
| 2026-09-09 | Takeout P0, 계정 연결 이전 P1 | 공식 API 지원 국가/승인 제한 |
| 2026-09-09 | 개인 폴더 P0 | 가져온 Google 리스트 이름/소속 보존 |
| 2026-09-09 | 작은 공유 웹 P0 | 앱 미설치자의 지역 공유 열람 유지 |
| 2026-09-09 | iOS 정상 Share Extension | 실험적 메인앱 자동 열기 회피 |
| 2026-09-09 | iOS 공유 수신은 자체 App Group inbox와 Swift 확장으로 구현 | Expo 57의 incoming-sharing iOS 자동 main-app 실행 방식은 P0 정책과 맞지 않음 |
| 2026-09-09 | Google 좌표 DB 캐시는 기본 비활성 | 저장/백업 수명 확인 후 허용 범위에서 활성화 |
| 2026-09-09 | 제품명 `LiveToEat`, 저장소/패키지명 `live-to-eat` | 사용자 지정 |
| 2026-09-09 | 공유 웹은 Vite + React로 구성 | 앱 미설치 열람에 필요한 작은 정적 웹 범위 유지 |
| 2026-09-09 | 루트 README를 제품 소개와 문서 진입점으로 유지 | 실행 명령 중심이 아닌 제품 이해를 위한 첫 화면 제공 |

## 10. 문서 패키지 QA

배포 전 이 패키지의 파일 수, UTF-8 인코딩, 상대 링크, 요구사항/작업 ID 연결, 예시 JSON 문법, 비밀키 포함 여부, ZIP 무결성을 검사한다. 검사 결과는 아래에 갱신한다. 이는 앱/SQL/스토어 기능 테스트 결과가 아니다.

문서 QA 결과 (2026-09-09): MD 6개, 상대 문서 링크 13개, 공식 근거 참조 라벨 43개를 검사했다. UTF-8 읽기, 코드블록 16개 닫힘, JSON 예시 2개 구문, 요구사항 R01~R20의 작업 B01~B18 및 테스트 T01~T16 연결을 통과했다. 알려진 형태의 실제 비밀키/토큰 패턴은 발견되지 않았다. 이전 Next.js/카카오 언급은 폐기/이전 문서 설명에만 있다.

기존 문서 패키지의 ZIP 무결성 검사는 원본 문서 전달 단계에서 완료했다. 현재 프로젝트에서는 문서 검사, lint, TypeScript 컴파일, 단위 테스트, Expo 의존성 검사, Expo Doctor, iOS/Android JS bundle, 공유 웹 production bundle, Android debug 네이티브 빌드를 실행했다. Supabase/RLS, 실제 Google API 호출과 지도 렌더링, Takeout 파싱, iOS 네이티브 빌드, 실기기와 스토어 테스트는 아직 미실행이다.

## 11. 작업 기록

### 2026-09-09 — B01 기반 설정

- 작업: B01 / R20
- 변경: npm workspaces 루트, Expo Development Build 모바일 앱, Vite 공유 웹, 공통 도메인 패키지, Supabase 로컬 디렉터리와 환경변수 예시를 생성했다. 제품 표시명은 `LiveToEat`, 프로젝트명은 `live-to-eat`로 고정했다.
- 실행: Node 24.20.0과 npm 11.17.0에서 `npm run check`, `expo install --check`, `expo-doctor`, iOS/Android `expo export`, `npm run build:share`, Expo prebuild와 Android `assembleDebug`를 실행했다.
- 검증: lint/typecheck/문서 검사와 단위 테스트 3건, Expo Doctor 21/21, 양 플랫폼 JS bundle, 공유 웹 build, Android debug APK가 성공했다. 지도 키는 제한된 실키가 아닌 예시값이므로 실제 지도 렌더링 성공을 의미하지 않는다.
- 정책/비용: 외부 프로젝트, API, 과금, 인증서, 도메인, 배포는 생성하거나 변경하지 않았다. Supabase 신규 테이블 자동 노출은 명시적으로 끄고 비공개 기본값을 도메인 테스트로 고정했다.
- 남은 것: 전체 Xcode 설치 후 iOS 네이티브 빌드, 소유자 확정 bundle/package ID, 제한된 Google Maps/Places 키, Docker 기반 Supabase 테스트, 승인된 Takeout fixture와 실제 기기 검증이 필요하다. 런타임 감사의 중간 심각도 이슈는 Expo 도구 체인의 상위 의존성 수정 여부를 추적한다.

### 2026-09-09 — B01 모바일 플랫폼 경계 수정

- 작업: B01 / R20
- 변경: `apps/mobile/app.config.ts`에서 모바일 Expo 앱의 플랫폼을 iOS/Android로 명시했다. 웹 공유 화면은 별도 Vite workspace인 `apps/share`가 담당하므로, Expo Router가 모바일 앱의 웹 번들을 요청하지 않게 한다.
- 실행: 예시 개발 환경변수를 로드한 뒤 Expo public config 확인과 Android export를 실행했다.
- 검증: config의 platforms가 `ios, android`으로 확인됐고, Android bundle 1개를 `/private/tmp/live-to-eat-android-diagnostic`에 성공적으로 export했다. 웹 공유 앱의 별도 build는 이번 변경에서 재실행하지 않았다.
- 정책/비용: 변경 없음.
- 남은 것: 실제 Android development build 설치/실행과 실제 Google Maps 렌더링은 제한된 키 설정 후 별도 검증한다.

### 2026-09-09 — 제품 소개 README 추가

- 작업: 문서 진입점 / R01~R20
- 변경: 루트 `README.md`에 제품 정의, 핵심 기능과 공개·개인정보 원칙, 현재 구현 상태, 상세 문서 링크를 추가했다.
- 실행: README의 다섯 상대 문서 링크 존재 여부와 `npm run check:docs`를 실행했다.
- 검증: 다섯 링크 대상이 모두 존재하고 문서 검사 6개 파일을 통과했다.
- 정책/비용: 변경 없음.
- 남은 것: README가 실행 지침을 중복하지 않도록 제품·문서 구조 변경 시에만 최신화한다.

### 2026-09-09 — B01 저장소 초기화와 원격 연결

- 작업: B01 / R20
- 변경: `develop`을 통합 기준으로 두고 `chore/initial-project-foundation` 작업 브랜치에서 초기 프로젝트 커밋을 만들었다. GitHub `origin` 원격을 연결했다.
- 실행: `npm run check`, React Doctor changed-scope 검사, 커밋 전 staged diff 검사, `git push -u origin chore/initial-project-foundation`을 실행했다.
- 검증: lint, TypeScript, 단위 테스트 3건, 문서 검사와 React Doctor 100/100을 통과했다. GitHub 원격의 브랜치 SHA가 초기 커밋과 일치하는 것을 확인했다.
- 정책/비용: 변경 없음.
- 남은 것: 일상 작업은 `develop`을 기준으로 새 작업 브랜치를 만들고 PR로 통합한다.

### 2026-09-09 — B02 지도 화면과 Google provider 연결 시작

- 작업: B02 / R02, R17
- 변경: `MapView`를 iOS/Android 모두 `PROVIDER_GOOGLE`로 렌더링하는 내 지도 화면을 추가했다. 현재 위치 권한을 요청하지 않고 전 세계 초기 범위를 보여 주며, 저장이 비공개이고 타인의 기록이 자동 추가되지 않음을 빈 상태에서 안내한다. 실제 Google Maps 키가 설정됐는지는 키를 노출하지 않는 boolean config로만 앱에 전달한다.
- 실행: mobile lint/typecheck와 제한된 개발 환경변수를 로드한 Android Expo export를 실행했다.
- 검증: lint/typecheck 통과, Android bundle 1개를 `/private/tmp/live-to-eat-b02-android`에 성공적으로 export했다. 지도 저작자 표시는 MapView의 하단을 가리지 않도록 화면 오버레이를 상단에만 배치했다.
- 정책/비용: Google Maps SDK와 Google Places API (New)를 별도 경계로 유지했다. Places 서버 호출, API 키/결제 계정 생성, 실제 Google API 요청은 하지 않았다.
- 남은 것: 소유자가 iOS bundle ID와 Android package/SHA-1에 제한된 실제 Maps 키를 설정한 뒤, iOS/Android 실기기에서 지도 타일과 저작자 표시를 확인한다. 이후 Places API (New)를 Edge Function 경계로 구현하고 장소 10건 검색/표시와 호출 계측을 검증한다.

### 2026-09-09 — B03 Takeout 저장목록 CSV 파서 프로토타입

- 작업: B03 / R13, R15
- 변경: 공통 도메인 패키지에 Google Takeout 저장목록 CSV를 정규화하는 파서를 추가했다. 설명행/빈 행 뒤의 알려진 헤더, UTF-8 BOM, 따옴표 안 쉼표·줄바꿈, title/URL/note/tags/comment을 처리한다. 입력 URL이 유효하지 않으면 제목은 보존하되 URL을 신뢰하지 않는 경고를 남긴다. 알 수 없는 헤더와 깨진 따옴표 CSV는 추측하지 않고 거절한다.
- 실행: domain unit test, typecheck, lint를 실행했다.
- 검증: 단위 테스트 7건이 통과했다. 합성 fixture에서 개인 폴더명, 개인 note/comment, tags, 안정적 행 키와 malformed CSV 거절을 확인했다.
- 정책/비용: 개인 입력은 정규화 결과의 private import 후보로만 다룬다. Google API 호출, 실제 사용자 파일 읽기/업로드, 공개 장소 데이터 생성은 하지 않았다.
- 남은 것: 본인 동의 및 비식별화한 실제 Takeout fixture로 실제 헤더/경로/목록명/좌표 유무를 검증한다. ZIP 선택·크기/압축 보안 검사·여러 파일 처리·모바일 미리보기와 서버 batch commit은 후속 B09/B10 범위다.

### 2026-09-09 — B04 공유 링크 수신 inbox 스파이크

- 작업: B04 / R14
- 변경: `modules/share-inbox`에 Android `text/plain` `ACTION_SEND` 전용 수신 Activity와 Expo native module, iOS App Group inbox native module을 추가했다. iOS CNG plugin은 정상 Share Extension target을 생성하고 링크/텍스트 한 건을 App Group에 기록한 뒤 요청을 완료한다. 메인 앱을 여는 코드와 로그인 토큰 공유는 넣지 않았다. 공통 domain은 HTTP(S) URL만 동일한 `google_url` 후보 입력으로 정규화하고, redirect/Google Place ID 추출/자동 저장을 하지 않는다. 앱은 수신 링크의 host만 표시하고 사용자가 지울 수 있게 하며, 저장은 이후 장소 확인 흐름이 맡는다.
- 실행: domain unit test·mobile/domain typecheck·lint, iOS `expo prebuild --platform ios --no-install`, iOS/Android Expo module autolinking resolve, Android `expo prebuild --platform android --no-install`, Android `./gradlew app:assembleDebug`, Android Expo export를 실행했다.
- 검증: domain 테스트 10건이 통과했고 만료, 비 HTTP(S) 입력, 동일 링크 중복 제거를 확인했다. iOS 생성 프로젝트에 `LiveToEatShareInbox` extension target, main/extension App Group entitlement, 앱 자동 열기 호출이 없는 Swift source가 생성됐다. Android debug APK와 JS bundle이 생성됐고 병합 manifest에 `ShareInboxActivity`의 `ACTION_SEND` + `text/plain` filter가 포함됐다. 로컬 `xcodebuild`는 Xcode 대신 Command Line Tools만 가리켜 iOS 네이티브 빌드는 실행할 수 없었다.
- 정책/비용: 외부 URL fetch, Google API/Place ID 해석, 계정/키/도메인/과금 변경은 하지 않았다. inbox는 기기 로컬 7일·최대 20개로 제한하며, 화면에는 원문이 아닌 host만 표시한다.
- 남은 것: 실제 Android 기기에서 Google Maps 공유 시 cold/warm start와 중복 제거를 녹화하고, Xcode·등록된 App Group을 준비해 iOS extension을 실제 서명/실기기 검증한다. B11에서 서버 Place Details 확인과 사용자 저장·로그아웃 계정 경계를 연결한다.

## 공식 근거

[D1]: https://docs.expo.dev/more/create-expo/
[D2]: https://docs.expo.dev/guides/environment-variables/
[D3]: https://developers.google.com/maps/api-security-best-practices
[D4]: https://docs.expo.dev/versions/latest/sdk/map-view/
