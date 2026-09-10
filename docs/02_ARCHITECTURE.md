# 02. 앱 구조, 데이터와 보안

버전 2.0 | 기준일 2026-09-09 | 아래는 구현 계약이며 실행된 코드/SQL이 아니다.

## 1. 확정 기술 구조

| 영역 | 선택 | 이유/경계 |
|---|---|---|
| 앱 | React Native + Expo + TypeScript | iOS/Android 공통 코드. Expo Go만으로 출시 검증하지 않는다. |
| 빌드 | Expo development build, CNG/config plugin, EAS Build/Submit | 필요한 네이티브 SDK/확장을 포함한다. 생성된 네이티브 파일 수동 수정에 의존하지 않는다. |
| 화면 | Expo Router, React Native 기본 UI, 공통 디자인 토큰 | 라우트와 기능 도메인을 분리한다. |
| 패키지 관리 | npm workspaces, 루트 package-lock.json | pnpm/yarn/bun lockfile을 섞지 않는다. |
| 앱 지도 | react-native-maps + PROVIDER_GOOGLE | iOS/Android 모두 Google 지도. 웹뷰 지도는 앱의 기본 구현이 아니다. |
| 장소 검색 | 서버 Google Places API (New) | 클라이언트의 임의 URL/FieldMask를 프록시하지 않는다. |
| 백엔드 | Supabase Auth, PostgreSQL, PostGIS, Edge Functions | 소유 데이터에 RLS. 공개 열람은 제한된 서버 DTO. |
| 데이터 요청 | TanStack Query + 런타임 검증 스키마 | 서버 상태와 화면 상태를 분리한다. Google 응답의 디스크 캐시는 금지한다. |
| 로그인 | Google, Apple | 장소 검색과 로그인 권한을 분리한다. |
| 민감 로컬 저장 | expo-secure-store 기반 세션 어댑터 | 토큰은 평문 AsyncStorage에 저장하지 않는다. |
| 작은 공유 웹 | Vite + TypeScript, Google Maps JavaScript API | 공유/공개 지도 열람, 약관/문의/탈퇴 안내, 앱 연결만 제공한다. |
| 웹 호스팅 | Firebase Hosting + 소유 도메인 | Auth/DB는 Supabase 유지. Firebase Dynamic Links는 사용하지 않는다. |

Expo는 react-native-maps의 양 플랫폼 Google provider와 앱 배포 시 키 설정을 안내한다. `expo-maps`는 조사 시 iOS에서 Apple Maps를 사용하므로 이 제품의 양 플랫폼 Google 요구에 채택하지 않는다. [A1][A2]

```text
apps/mobile (React Native) ────────┐
                                 ├─ Supabase Auth / RLS RPC / Edge Functions
apps/share (작은 공유 웹) ──────────┘          │
                                             ├─ PostgreSQL + PostGIS
                                             └─ Google Places API (New)
앱 지도 → Google Maps SDKs
공유 웹 지도 → Google Maps JavaScript API
```

별도 Express 서버, Next.js, Kafka, 검색 클러스터, 마이크로서비스를 먼저 추가하지 않는다. Expo SDK/React Native/지도 패키지의 실제 호환 버전은 M0에서 선정해 고정한다.

## 2. 저장소 구조

```text
AGENTS.md
docs/                           # 이 패키지의 상세 MD 5개만 유지
apps/
  mobile/
    src/app/                    # Expo Router 라우트
    src/features/               # auth, maps, places, discover, shares, settings
    src/components/             # 공통 UI와 지도 어댑터
    src/lib/                    # supabase, secure storage, analytics, i18n
    locales/ko.json
    locales/en.json
    app.config.ts
    eas.json
  share/
    src/                        # 읽기 전용 공유 지도/공개 프로필
    public/.well-known/         # AASA, assetlinks.json
    public/legal/               # 실제 약관/개인정보/문의/탈퇴 안내
    firebase.json
packages/
  domain/                       # 순수 TS 타입/검증/지역 모델. React Native import 금지
supabase/
  migrations/                   # 모든 DB/권한 변경의 원본
  functions/app/                # 제한된 HTTP 엔드포인트
  functions/account-delete/     # 재인증/삭제/제공자 토큰 철회
  functions/maintenance/        # 인증된 정리 작업
  tests/                        # 실제 PostgreSQL 권한/멱등성 테스트
  seed.sql                      # 합성 테스트 데이터, 실제 사용자 자료 금지
plugins/                        # 지도 설정과 재현 가능한 네이티브 생성
scripts/                        # 지역 적재, 데이터 검사, 운영 검증
package.json
package-lock.json
```

`packages/domain`은 TS 원본 진입점/exports를 명확히 하고 Metro/Vite 모두에서 검증한다. Deno Edge Functions는 npm/JSR 지원과 실제 배포 번들 포함 범위를 검증한다. 모노레포 상대경로만 맞는다고 Edge 배포까지 된다고 가정하지 않는다. 모든 데이터 계약 테스트를 앱과 서버에서 공통 실행한다.

## 3. 인증과 모바일 세션

Supabase의 공식 React Native 인증 구성을 출발점으로 쓴다. AppState에 따른 토큰 자동 갱신 시작/중단을 적용하고, 화면 접근 제한과 서버 권한 검사를 별도로 둔다. [A3]

Google 로그인은 시스템 브라우저 OAuth + PKCE를 기준으로 한다. WebBrowser 인증 세션, 정확한 callback allowlist, code 교환을 검증한다. WebView 안에서 Google 비밀번호를 받지 않는다. 네이티브 Google 로그인으로 변경하면 ID token의 audience/client ID 구성을 별도 ADR 대신 04의 결정 기록에 남긴다.

Apple은 iOS의 네이티브 Sign in with Apple을 사용한다. nonce 검증과 Supabase ID token 교환을 적용한다. Android에는 Supabase Apple OAuth 브라우저 경로를 제공하여 Apple 가입 계정을 다시 쓸 수 있게 한다. Apple Services ID와 네이티브 App ID 그룹 관계, relay 이메일과 subject 일치를 실제 테스트한다. 제3자 로그인 사용 앱에 대한 Apple 로그인 옵션 요구를 고려한 선택이다. [A4][A5]

공개 닉네임은 사용자 확인 후 설정한다. 동일 이메일만 보고 클라이언트에서 계정을 합치지 않는다. Supabase의 검증된 identity linking을 따르며 두 로그인 수단이 서로 다른 계정을 만들면 명시적 연결/복구 화면으로 안내한다. 마지막 로그인 수단을 연결 해제해 계정을 잠그지 않는다.

세션 어댑터 요구:

- `getItem/setItem/removeItem`을 구현하고 로그아웃/탈퇴/계정 전환 시 토큰과 해당 계정 캐시를 지운다.
- 큰 세션은 SecureStore 단일 값 제한에 걸릴 수 있다. UTF-8 크기로 나눈 generation 기반 chunk 저장, manifest 마지막 확정, 실패 시 이전 generation 유지, 오래된 chunk 제거를 테스트한다. 평문 저장으로 조용히 우회하지 않는다. [A6]
- access/refresh token, OAuth code, PKCE verifier, 공유 secret을 분석/크래시 로그에 남기지 않는다.
- 저장 확인 문맥은 앱 내부의 짧은 수명 pending action으로 보관한다. 로그인 callback query에 원본 공유 secret을 붙이지 않는다. 완료 후 현재 권한을 다시 확인하고 사용자에게 저장 확인을 받는다.
- 활성 계정 상태를 DB에서도 검사한다. 오래된 JWT가 남아 있어도 정지/탈퇴 사용자가 읽기/쓰기를 계속할 수 없게 한다.

민감 작업은 단순 토큰 refresh를 최근 재인증으로 간주하지 않는다. 탈퇴는 fresh provider 로그인/일회성 challenge로 동일 계정과 목적을 서버가 확인한다. Apple authorization code에서 철회용 토큰을 얻어야 하는 단계와 Supabase 세션 교환을 구분하고, 이 처리의 실패를 별도 기록한다. [A4][A13]

## 4. DB 논리 스키마

UUID를 내부 키로 쓴다. 외부 Place ID는 opaque text다. 시각은 UTC `timestamptz`, 사용자 방문일은 `date`. 변경 가능한 기록은 `version integer`로 동시 수정을 검사한다. 주소 문자열, 번역된 지역명, 좌표만으로 장소를 동일시하지 않는다.

| 테이블 | 주요 필드와 제약 |
|---|---|
| `profiles` | id FK auth.users, handle UNIQUE, display_name, bio, public_map_enabled DEFAULT false, locale, time_zone. 이메일/제공자 식별자는 공개 필드가 아니다. |
| `private.account_states` | user_id, state onboarding/active/suspended/deleting, changed_at. 사용자 수정 불가. |
| `user_settings` | user_id, terms_version, privacy_notice_version, age_gate_version, age_confirmed, analytics_opt_in=false. 고지/동의 근거를 구분한다. |
| `place_refs` | id, provider='google', provider_place_id UNIQUE, replacement_ref_id NULL, id_checked_at. Google 장소명/주소/평점을 영구 컬럼으로 넣지 않는다. |
| `saved_places` | id, user_id, place_ref_id NULL, resolution_state resolved/unresolved, visibility private/unlisted/public, visit_status want/visited, is_recommended, public_note, exposure_epoch, version, created_at. resolved일 때 user_id+place_ref_id UNIQUE. |
| `saved_private` | saved_id PK/FK CASCADE, personal_note, tags, visited_on, user_label, input_provenance. 소유자 전용. |
| `collections` | id, user_id, name, origin manual. P0는 개인 폴더이며 공개범위 상속 없음. |
| `collection_items` | collection_id, saved_id 복합 PK. 두 레코드의 소유자가 같아야 한다. |
| `region_nodes` | id, country_code, parent_id, kind, source_key/source_id, localized_names, source_version. 가변 깊이/순환 금지. |
| `region_closure` | ancestor_id, descendant_id, depth. 자신 포함. 하위 지역 검색에 사용. |
| `saved_regions` | saved_id, region_id, origin user_selected/independent_source, selected_at. Google 주소를 무단 영구 가공하는 우회 테이블로 쓰지 않는다. |
| `private.google_location_cache` | place_ref_id PK, location geography(Point,4326), fetched_at, expires_at. 정책/백업 조건 충족 전 비활성. 03의 저장 정책 적용. |
| `private.shares` | id, owner_id, token_hash, selected_region_id NULL, expires_at, revoked_at, created_at. 원문 secret 저장 금지. |
| `private.share_items` | share_id, saved_id, granted_epoch, removed_at. 생성 시 선택된 저장만 보관. |
| `private.blocks/reports` | 차단 쌍 UNIQUE, 신고 대상/사유/상태. 신고자 정보와 운영자 메모는 비공개. |
| `private.admin_memberships/audit_events` | 운영 권한과 조치 기록. user_metadata의 role을 신뢰하지 않는다. |
| `private.request_keys/rate_limits/deletion_jobs` | 요청 멱등성, 비용/호출 제한, 계정 삭제 진행 상태. client가 직접 수정 불가. |

핵심 인덱스: saved_places(user_id, created_at, id), 공개 탐색 대상(user_id, visibility), saved_regions(region_id, saved_id), collection_items(saved_id), share_items(share_id, saved_id), 위치 캐시의 GiST. 전체 텍스트 Google 장소 검색 인덱스는 만들지 않는다.

unresolved 저장은 개인 목록에서 유지할 수 있지만 public/unlisted로 바꿀 수 없다. 사용자가 작성한 미해결 개인 기록과 자기 메모는 보존한다. 가짜 좌표/Place ID를 채우지 않는다. 장소가 병합되면 같은 사용자의 두 저장을 중복 처리하되 메모를 삭제하지 않고 충돌 검토 대상으로 둔다.

원본 작성자가 탈퇴해도 다른 사람의 독립 저장/공통 Place ID를 삭제하지 않는다. 원본 사용자 참조만 제거한다. 폴더/장소 변경에는 FK 소유권 검사와 트랜잭션을 적용한다.

## 5. 권한 경계

RLS는 owner 테이블 전부에 활성화한다. `user_id=auth.uid()`와 활성 계정 상태를 함께 확인한다. 타인 지도는 base table SELECT를 열어서 구현하지 않는다. 공개 SQL view는 열 숨김과 실행 권한까지 검증해야 한다. Supabase의 RLS 지침을 따른다. [A7]

| 요청 | 실행 경로 | 강제하는 권한 |
|---|---|---|
| 내 프로필/저장/폴더 조회 | 사용자 JWT로 Supabase | RLS + active 상태 |
| 저장 생성/복사/공개범위 변경 | 사용자 JWT로 제한된 RPC | auth.uid(), 소유권, 입력 검증, 멱등성, 활성 링크 재검증 |
| 공개 지도/둘러보기 | Edge → 서버 전용 제한 RPC | 공개 지도 활성 + public + moderation + 차단 + pagination |
| 공유 열람 | Edge → 서버 전용 제한 RPC | secret hash + 만료/철회 + 현재 epoch/visibility + 선택 항목 |
| Google 검색/상세 | Edge 전용 | 요청 인증/열람 증명, 서버 FieldMask, 호출/비용 제한 |
| 운영 조치/계정 삭제 | 별도 서버 함수 | 검증된 사용자, 관리자/최근 재인증, 감사 이벤트 |

service role은 모든 RLS를 우회할 수 있으므로 서버만 보유한다. 해당 키를 쓴 함수에서 임의 user_id나 임의 place ID를 신뢰하지 않는다. 모든 공개 서버 응답은 정해진 DTO 필드만 반환한다. service role을 사용하는 공개 조회 RPC에는 anon/authenticated의 직접 실행 권한을 주지 않는다.

security definer RPC는 `SET search_path=''`, 완전 수식 테이블명, 기본 PUBLIC EXECUTE 회수, 최소 grant를 적용한다. 쓰기 제한은 RPC에도 둔다. Edge만 막고 공개 PostgREST를 통해 우회 호출되는 상태를 허용하지 않는다.

공개 열람과 인증 요청이 같은 Edge gateway에 있으면 배포의 `verify_jwt` 기본값에 의존하지 않는다. 비회원 허용 gateway는 `verify_jwt=false`로 명시하되, 인증이 필요한 모든 route는 서버에서 Supabase 검증 함수로 access token의 서명/만료/사용자를 확인한다. 단순 JWT decode는 인증이 아니다. JWT를 보냈는데 무효인 요청을 비회원으로 조용히 강등하지 않는다. 별도 삭제/관리 함수는 해당 경로의 인증 정책을 명시한다. 배포된 비회원 요청과 무효 토큰 요청을 함께 테스트한다. [A14]

첫 로그인은 검증된 Auth 사용자에 대해 멱등 bootstrap을 수행한다. onboarding 상태는 닉네임/약관/연령 확인에 필요한 자기 정보에만 접근 가능하며, 서버의 온보딩 완료 절차가 active로 전환한다. 일반 RLS의 active 조건 때문에 최초 가입이 막히지 않도록 별도 제한 경로를 제공한다.

## 6. API 계약

아래 경로는 `functions/v1/app` 아래에 구현할 논리 HTTP 경로다. API 버전은 v1이다. JSON만 받고 모든 입력 길이/enum/UUID/권한을 서버에서 검증한다. 클라이언트 요청의 actor_id는 받지 않는다.

| 경로/방식 | 입력 요약 | 결과/제약 |
|---|---|---|
| `POST /account/bootstrap`, `/account/onboarding` | 검증된 로그인, 프로필/고지 확인 입력 | 자기 계정만 멱등 생성/활성화. 역할/정지 상태를 client가 지정할 수 없음 |
| `POST /places/search` | query, appRegionId?, languageCode, searchSessionId | 최대 5개 후보, Google attribution, 선택용 짧은 서명 ticket |
| `POST /places/details` | 선택 ticket 또는 현재 열람 가능한 savedId/share context | Google live DTO. 앱 ID 존재만으로 임의 대량 상세 요청 허용 금지 |
| `POST /saved/create` | ticket, ownNote?, regionIds?, Idempotency-Key | private/want. 이미 있으면 기존 savedId |
| `POST /saved/copy` | sourcePublicSavedId 또는 share proof, Idempotency-Key | 현재 원본 접근 재검사. 내 private 기록만 생성 |
| `PATCH /saved/:id` | expectedVersion, 변경 가능한 필드 | 충돌 409. private 전환 시 관련 share_items 폐기, 지역 변경 시 범위를 벗어난 공유 항목 폐기 |
| `DELETE /saved/:id` | Idempotency-Key | 삭제/링크 제외 원자 처리 |
| `GET /discover` | regionId?, query?, cursor?, limit<=20 | 공개 프로필 DTO. 비공개 총수 제외 |
| `GET /public/:handle` | regionId?, cursor?, limit<=50 | 허용 savedId/Place ID/공개 설명/분류만 |
| `POST /shares` | savedIds<=200, regionId?, expiresAt, 공개범위 변경 확인, key | id와 secret을 최초 1회 반환 |
| `POST /shares/read` | shareId, secret, cursor? | 현재 허용된 공유 DTO. no-store. secret 없는 ID 조회 불가 |
| `POST /shares/:id/revoke` | key | 소유자 확인, 즉시 철회 |
| `POST /account/export` | format, includeNotes, recentAuthProof | 내 데이터 파일/안전한 응답, 재배포 제한 필드 제외 |
| `POST /reports`, `/blocks` | 접근 가능한 target와 사유 | 제한된 접수 결과. 차단은 인증 필요 |
| `POST /account/delete` | recentAuthProof, confirmation | deleting으로 전환, 공개 차단, 삭제 jobId |

대표 오류 형식:

```json
{"error":{"code":"PLACE_UNRESOLVED","messageKey":"place.unresolved","retryable":false},"requestId":"opaque-id"}
```

공통 코드: UNAUTHENTICATED, FORBIDDEN, NOT_FOUND, VERSION_CONFLICT, INVALID_INPUT, RATE_LIMITED, PLACE_UNRESOLVED, PROVIDER_UNAVAILABLE, COST_LIMIT_REACHED. 오류에 개인 메모/토큰/Google 응답 원문을 넣지 않는다. 메시지는 클라이언트 번역 키로 표시한다.

saved/create는 중복키+DB UNIQUE로 보장한다. `select 후 insert`만으로 중복을 막지 않는다. 동일 멱등키에 다른 payload는 409, 중복 요청은 같은 결과. 단순 클라이언트 메모리 상태로 성공을 판단하지 않는다.

## 7. 공유 링크와 작은 웹

공유 링크 형식은 아래처럼 ID와 비밀값을 분리한다.

```text
https://<owned-domain>/s/<share-id>#k=<32-byte-random-base64url-secret>
https://<owned-domain>/u/<public-handle>
```

secret은 URL fragment로 전달하고 앱/웹에서 추출해 POST body로 서버에 보낸다. 경로의 share ID만으로 내용을 반환하지 않는다. fragment도 클라이언트 로그/세션리플레이에 남을 수 있으므로 전부 마스킹한다. 서버에는 SHA-256 hash만 저장한다. 원문 분실 시 조회/복원이 아니라 재발급한다.

웹은 먼저 일반 서비스 안내를 렌더링하고 접근 검증 후 장소를 요청한다. `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, `noindex`, 일반 OG를 적용한다. 토큰 제한 지도의 장소명/닉네임을 링크 미리보기나 정적 HTML에 넣지 않는다. 공개/공유 데이터에 CDN cache를 켜지 않는다.

공유의 selected_region_id가 있는 경우 현재 저장의 지역/하위 지역 소속도 검사한다. 지역 수정으로 범위를 벗어나면 해당 share_item을 영구 폐기하며, 다시 돌아와도 자동 재추가하지 않는다. 공유 생성 후 추가된 장소는 별도 새 공유로만 포함한다.

Google SDK 자체 지도 저작자 표시를 가리지 않는다. 목록으로만 Google 장소 정보를 보여주면 적절한 Google Maps attribution도 표시한다. [03 정책](03_MAPS_AND_IMPORT.md) 참고.

자체 도메인에 `/.well-known/apple-app-site-association`과 `/.well-known/assetlinks.json`을 HTTPS/올바른 MIME/리다이렉트 없이 제공한다. iOS entitlement와 Android autoVerify/signing fingerprint를 실제 배포 앱과 연결한다. Firebase Hosting의 기본 숨김 파일 제외 규칙 때문에 .well-known이 빠지지 않게 검사한다. [A8][A9]

설치된 앱은 Universal Links/App Links로 해당 지도를 연다. 미설치는 웹으로 열린다. 설치 이후 원래 화면이 자동 복원되는 deferred deep linking까지 보장하지 않는다. 설치 후 원본 링크 다시 열기/직접 링크 붙여넣기를 제공한다. Firebase Dynamic Links는 종료된 제품이므로 사용하지 않는다. [A10]

## 8. 운영 보안 기본값

Google 서버 API 키, Supabase service role/secret, Apple .p8와 OAuth secret은 서버 비밀 저장소에만 둔다. 공개 모바일 API 키도 앱 식별자와 허용 API로 제한한다. 키 역할을 하나로 합치지 않는다. [A12]

공개 메모는 HTML이 아닌 텍스트다. SQL/XSS/URL scheme/CSV 수식 공격을 검사한다. 외부 URL fetch는 03의 allowlist/SSRF 규칙을 통과한 경우만 허용한다. 공개 API에 요청/계정/IP 단위 한도, timeout, 응답 개수 상한과 서버 kill switch를 둔다. CORS는 인증 대체물이 아니다.

오프라인 전체 지도/수정 큐는 P0에서 제공하지 않는다. 화면에 이미 있던 본인 기록을 읽는 경우에도 오프라인임을 표시하고 쓰기는 재연결 후 재검증한다. 타인 지도를 오프라인 영구 캐시하지 않는다.

## 공식 근거

확인일은 2026-09-09다. 정책/SDK가 바뀌면 구현 전에 해당 링크를 재확인한다.

[A1]: https://docs.expo.dev/versions/latest/sdk/map-view/
[A2]: https://docs.expo.dev/versions/latest/sdk/maps/
[A3]: https://supabase.com/docs/guides/auth/quickstarts/react-native
[A4]: https://supabase.com/docs/guides/auth/social-login/auth-apple
[A5]: https://developer.apple.com/app-store/review/guidelines/
[A6]: https://docs.expo.dev/versions/latest/sdk/securestore/
[A7]: https://supabase.com/docs/guides/database/postgres/row-level-security
[A8]: https://docs.expo.dev/linking/overview/
[A9]: https://firebase.google.com/docs/hosting/full-config
[A10]: https://firebase.google.com/support/dynamic-links-faq
[A12]: https://developers.google.com/maps/api-security-best-practices
[A13]: https://developer.apple.com/support/offering-account-deletion-in-your-app/
[A14]: https://supabase.com/docs/guides/functions/auth
