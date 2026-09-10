# 05. 테스트, 보안 운영과 앱 출시

버전 2.0 | 기준일 2026-09-09 | 실제 실행 결과는 [개발 기록](04_DEVELOPMENT.md)에 작성

## 1. 출시의 정의

우리의 목표는 웹 배포나 Expo Go 실행이 아니라 iOS App Store와 Android Google Play에서 사용자가 설치하는 앱이다. `코드 작성 → 로컬 테스트 → 서명된 빌드 → 베타 → 심사 제출 → 승인 → 실제 공개`를 각각 구분한다. EAS Submit 성공은 스토어 공개 성공이 아니다. [L1][L2]

문서 작성 시점에는 실제 계정·DB·API 연동과 스토어 빌드를 모두 검증하지 않았다. 아래 항목은 앞으로 충족할 출시 조건이다. 체크하지 않은 일을 완료로 보고하지 않는다.

## 2. 필수 테스트 매트릭스

테스트 도구는 unit/domain에 Vitest, React Native 화면에 Jest와 React Native Testing Library, DB에 Supabase 로컬 SQL/pgTAP, 실제 앱 흐름에 Maestro를 기본 후보로 한다. 선택한 Expo/RN 버전과 호환을 M0에서 확인하고 버전을 고정한다. 동일 테스트를 두 runner에 중복 소유시키지 않는다. 웹 링크/표시는 Playwright 또는 실제 브라우저로 검증한다.

| 테스트 ID | 시나리오/필수 검증 | 관련 요구사항 |
|---|---|---|
| T01 | Google/Apple 로그인, 취소, PKCE/nonce 실패, 토큰 갱신, 앱 재시작, SecureStore 큰 세션/부분 저장 실패, 로그아웃 후 다른 계정의 캐시 누출 없음 | R12 |
| T02 | A/B/비회원/정지/탈퇴 계정의 RLS와 RPC 권한, service role 우회 경로 차단, 개인 메모/태그/정확한 방문일/숨긴 저장 수 비노출 | R05,R09,R12 |
| T03 | 검색→저장→종료→재접속, 중복 버튼, 재시도, 동시 수정 version 충돌, 폴더 중복 소속, 삭제 후 목록/지도 일치 | R01,R02,R03 |
| T04 | iOS/Android 모두 실제 Google 지도, development/preview/store 서명별 키, 위치 거절/제한/대략적 위치, 네트워크 단절, 장소 좌표 미확인, 목록 대체와 출처 표시 | R01,R02,R17 |
| T05 | 국가별 다른 지역 단계, 중간 단계 없는 지역, 동일 지명, 다국어 검색, 빈 지역, 날짜변경선 bounds, lat/lng 역전, 기기 언어/시간대 변경 | R07,R19 |
| T09 | 사람 중심 둘러보기, 공개된 것만 집계, 빈 피드, 본인 지도와 타인 지도 구분, 타인 저장을 내 private 기록으로 복사, 원작자 비공개 전환 후 내 독립 기록 보존 | R04,R05,R06 |
| T10 | 선택 지역/선택 장소만 공유, 공유 후 새 저장 자동 추가 금지, 만료/철회/토큰 재발급, private→public 후 옛 공유 부활 금지, 전체 외부 공개 중단 | R08,R09,R10 |
| T11 | 앱 미설치 웹 지도/목록, 설치 앱으로 연결, 카톡/메신저/브라우저를 거친 fragment 유지, cold/warm start, 로그인 후 원래 장소 저장, AASA/assetlinks 배포, noindex/no-store | R06,R08,R11 |
| T12 | 본인 JSON/CSV 내보내기, private 컬럼의 본인 접근 확인, CSV 수식 주입 방지, Google API 응답/타인 메모 제외, 파일 임시 저장 삭제 | R16 |
| T13 | 앱 내부/외부 웹 탈퇴, 본인 재인증, provider revoke, 삭제 재시도, 공개 링크 즉시 차단, 구 토큰으로 접근 거부, 백업 복원 시 삭제 상태 재적용 | R12,R18 |
| T14 | 신고 접수→운영자 처리→숨김/이의 문의, 차단 관계의 로그인 탐색, 관리 권한 검증, 공개 설명의 스팸/유해 내용, 연락처 동작 | R18 |
| T15 | Places field mask/호출 수/쿼터, 익명 API 비용 공격, 토큰/주소/메모 로그 유출, Google 캐시/백업 삭제 수명, 장애 시 kill switch, 데이터 복구 연습 | R02,R09,R17,R20 |
| T16 | 작은 화면/큰 글씨/VoiceOver/TalkBack, ko/en 번역 누락, 저사양 기기에서 500개 기록/지도 점진 로딩, 두 스토어 배포 빌드에서 핵심 흐름 회귀 검증 | R01,R11,R17,R19,R20 |

P0 blocker: 개인 정보 누출, 다른 계정 수정, 잘못된 장소 저장, 중복 저장, 철회 링크 계속 열림, API 키 오용, 앱 실행/로그인/저장/지도/공유 크래시. 성능 목표는 M0 기준 기기에서 계측값으로 정한다. 실제 네트워크 API 시간을 제외한 화면 지연도 따로 기록한다. 성능 수치를 측정하지 않고 60fps 보장을 마케팅에 쓰지 않는다.

## 3. 실제 모바일 빌드와 링크 점검

Development는 Expo development client와 native 기능 검증, preview는 내부 배포와 백엔드 통합 검증, production은 스토어용 서명으로 분리한다. Expo Go에서 보이는 지도가 실제 release key의 정상 동작을 증명하지 않는다. iOS 지도는 Apple Maps로 조용히 fallback하지 않는다. [L1]

`apps/mobile/eas.json` 구조 예시다. CLI 버전은 package.json/lockfile에 고정하고 실제 계정과 프로젝트 식별자는 소유자가 설정한다. 이는 이미 빌드 가능한 완성 설정이 아니다.

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "channel": "development",
      "environment": "development"
    },
    "preview": {
      "distribution": "internal",
      "channel": "preview",
      "environment": "preview"
    },
    "production": {
      "distribution": "store",
      "autoIncrement": true,
      "channel": "production",
      "environment": "production"
    }
  },
  "submit": {
    "production": {}
  }
}
```

예시 명령은 CLI 설치/소유자 승인/프로젝트 연결/서명이 준비된 후 `apps/mobile`에서 실행한다. 유료 빌드와 공개 제출을 문서만 읽고 자동 실행하지 않는다.

```bash
npx eas build --profile preview --platform all
npx eas build --profile production --platform all
npx eas submit --profile production --platform ios
npx eas submit --profile production --platform android
```

스토어 제출 직전에 빌드 번호, bundle ID/package, signing profile, API 키 허용 인증서, production Supabase URL과 OAuth redirect를 재검증한다. 특히 Android의 Google 지도 키 제한은 해당 서명의 SHA-1, App Links 검증은 SHA-256이다. Play App Signing 인증서와 업로드 인증서를 혼동하지 않는다.

자체 도메인의 `/.well-known/apple-app-site-association`과 `/.well-known/assetlinks.json`은 실제 앱/서명 값으로 게시하고 HTTP 상태/Content-Type/리다이렉트 유무를 검사한다. Firebase Hosting의 숨김 파일 ignore 패턴에 `.well-known`이 빠져나가지 않게 한다. 공유 fragment가 실제 메신저에서 제거된다면 출시 blocker다. 더미 인증서/도메인으로 링크 연결 완료라고 쓰지 않는다. [L3]

미설치 사용자는 링크에서 곧바로 공유 웹을 본다. 스토어를 거쳐 새 설치한 뒤 원래 링크가 저절로 복원된다고 보장하지 않는다. 링크 재열기 경로를 제공한다. Firebase Dynamic Links는 2025-08-25에 종료되었으므로 새 설계에 사용하지 않는다. Firebase Hosting은 별도 서비스다. [L4]

## 4. 스토어 제출 요구사항

아래는 2026-09-09에 확인한 기준이다. 실제 제출 직전에 공식 정책과 선택한 빌드 이미지의 지원 여부를 다시 확인한다. 스토어의 조건은 코드만으로 충족되지 않는다.

| 항목 | 출시 조건 |
|---|---|
| iOS 빌드 도구 | 2026-04-28 이후 App Store Connect 업로드는 Xcode 26 이상과 iOS 26 SDK 이상 사용. 앱의 최소 지원 iOS가 26이어야 한다는 뜻은 아니다. [L5] |
| Android target | 2026-08-31 이후 일반 휴대폰 신규 앱/업데이트는 Android 16, API 36 이상 target. minSdk와 다르다. 예외/연장 승인 없이 낮은 target으로 출시 가능하다고 가정하지 않는다. [L6] |
| 개발자 계정 | 소유자 명의 Apple/Google 개발자 계정, 실명/조직/연락처/계약/결제/서명 관리. 계정 유형과 판매 국가의 요구를 소유자가 확인 |
| 베타 | TestFlight와 Play internal/closed 테스트에서 production에 가까운 환경으로 정의된 테스트 항목을 실행. 적용 대상인 신규 개인 Play 계정은 최소 12명의 테스터가 14일 연속 참여한 closed test 등 production 접근 신청 요건 확인. 모든 계정에 동일한 조건이라고 쓰지 않는다. [L7] |
| 로그인 | Google을 주 로그인으로 쓰므로 iOS에서 Apple의 4.8 조건에 맞는 동등한 로그인 선택지로 Sign in with Apple 구현. 해당 정책 예외가 있다고 임의로 전제하지 않는다. [L8] |
| 계정 삭제 | 앱 내부 삭제 기능과 실제 삭제 처리. Play에 동작하는 외부 삭제 요청 웹 주소도 제출. 앱 재설치만 요구하는 페이지 금지. Apple 로그인 토큰 철회 처리 포함. [L9][L10] |
| 공개 사용자 콘텐츠 | 공개 설명/프로필에 신고, 사용자 차단, 부적절한 콘텐츠 처리, 운영자 연락 경로. 공개 UGC가 있는데 관리 수단 없이 출시하지 않는다. [L8] |
| 개인정보 | 실제 동작과 일치하는 App Privacy/Data safety, 개인정보처리방침 URL, 인앱 고지, SDK 수집 내역, 목적별 권한 설명. Google 지도/분석 SDK까지 포함 |
| 앱 정보 | ko/en 이름/설명/지원 URL/개인정보 URL, 연령등급 설문, 실제 앱 화면의 규격별 스크린샷/아이콘, 심사 메모와 작동하는 리뷰 계정/재현 경로 |
| 국가 선택 | 첫 공개 국가별 지도/검색 품질, 앱/약관 언어, 고객지원, 데이터 처리 조건 확인. EU 배포 시 Apple의 trader 상태 등 해당 의무도 확인. [L5] |

제품 설명과 스크린샷은 Google Maps 지도와 Places 검색을 사용하는 범위를 정확히 표시한다. “Google 공식 앱/공식 제휴”를 암시하는 이름/로고도 사용하지 않는다.

초기 서비스는 아동 대상이 아니며 이용 최소연령과 국가별 동의/고지 요건을 정책 담당자가 출시 전에 확정한다. 스토어 연령등급, 실제 이용약관의 가입 연령, 개인정보 동의 요건을 같은 것으로 취급하지 않는다. 미성년자 지원/소셜 앱 관련 스토어 정책 적용 여부도 앱의 실제 분류로 확인한다. 정확한 생년월일을 기능상 필요 없이 수집하지 않는다.

## 5. 개인정보와 삭제 운영

이 절은 구현 점검표이지 국가별 법률 적합성 보증이 아니다. 출시 국가, 사업자 소재지, Supabase/Google/호스팅/오류 수집 처리 경로를 바탕으로 관련 개인정보 요건, 국외 이전 고지/계약, 보존 기간, 이용자 권리와 문의 창구를 검토한다. 한국어/영어 문서를 실제 처리 방식에 맞춰 게시하고 변경 버전/동의 이력을 저장한다.

P0 권한은 현재 위치 버튼의 foreground 위치에 필요한 최소 범위로 한다. 백그라운드 위치/연락처/통화 기록/사진 전체 접근은 요청하지 않는다. 위치를 자체 DB에 저장하지 않더라도 Google SDK/API에 전달되는 데이터가 있을 수 있으므로 “위치가 절대 기기 밖으로 나가지 않음”으로 고지하지 않는다.

크래시/분석 도구를 추가하면 이벤트에 private 메모, 주소, 좌표, 공유 secret, access/refresh token을 담지 않는다. 세션 녹화/화면 캡처는 P0 비활성이다. 오류 수집은 build/platform/error code/request ID 중심으로 하고 실제 제3자 전송 필드를 검사한다. SDK를 추가한 뒤 Data safety/App Privacy 검토도 다시 한다.

탈퇴 플로우: 최근 본인 재인증 → 서버에서 계정 deleting 전환/모든 공개 접근과 쓰기 차단 → 세션 철회 및 provider revoke 작업 → 사용자 데이터와 비밀 삭제 → Supabase Auth 사용자 삭제 → 완료 상태/재시도 감사. Apple revoke 등 후속 작업에 필요한 식별/철회 정보는 공개 데이터와 분리해 최소 범위로 안전하게 유지하고 성공 후 제거한다. Supabase Auth 행부터 지워 필요한 철회 정보를 잃지 않는다. [L9]

외부 삭제 요청 웹은 재설치 없이 시작할 수 있고 요청자의 본인 여부를 검증한다. 아무 이메일을 입력했다고 즉시 타인 계정을 지우지 않는다. 로그인 불가 시 지원 절차와 처리 상태를 제공하고 계정 존재 여부도 무단 공개하지 않는다. 법적 보존 의무가 있는 예외가 실제 있다면 대상/사유/기간을 명시한다. 임의로 모든 기록을 영구 보존하지 않는다. [L10]

계정 삭제/공유 철회가 이미 다른 사용자가 독립적으로 저장한 자기 기록이나 이전 스크린샷을 원격 삭제하는 것은 아니다. 프로필의 공개 설정과 사용자 차단은 비회원 인터넷 전체의 열람을 막는 기능도 아니다. 완전 비공개가 필요한 기록은 private으로 둔다. 이 한계를 UI/정책에서 구분한다.

## 6. 백업, 보안과 장애 대응

운영 기본값(법정 기간이 아니라 변경 가능한 제품 설정): 민감값을 제거한 진단 로그 30일, 최소한의 운영 보안 감사 90일. 실제 필요한 기간과 법적 검토 결과를 확정하고 TTL job/검사를 구현한다. 탈퇴/취소 시 기본 TTL보다 먼저 제거해야 하는 데이터는 즉시 처리한다.

Google 좌표 캐시는 기본 꺼짐이다. 켜는 경우 [03의 정책](03_MAPS_AND_IMPORT.md)을 따른다. 예를 들어 live 7일+백업 잔존 최대 7일로 실질 전체 수명을 제한하고 30일 한도를 넘는 스냅샷/수동 export/로그가 없는지 확인한다. `expires_at`만 두고 백업에서 영구 복원 가능하게 하는 것은 TTL 구현이 아니다.

Supabase 백업/PITR의 실제 플랜과 보존 설정을 확인한다. 새 환경 복원 연습에서 RLS, 삭제/차단 tombstone, 공유 철회 상태를 먼저 복원한 뒤 외부 트래픽을 연다. 법적 보존/사고 조사용 데이터를 일반 기능 DB로 되살리지 않는다. 앱 사용자 데이터, Google 제한 데이터, provider 철회 비밀은 복원 정책을 분리한다.

장애 runbook은 04의 작업 기록 안에 실제 수행 결과를 남긴다. API 비용 폭증이면 Places 검색 기능 flag와 서버 rate limit으로 신규 호출을 제한하고 개인 저장 기록은 보존한다. 지도 장애는 오류/목록으로 대체한다. 보안 사고라면 API/공유/계정 접근 범위를 차단하고 키/토큰 회전, 영향 평가, 필요한 고지와 복구를 담당자가 수행한다. 가격 알림은 자동 지출 차단 장치가 아니다.

모든 production 변경은 owner 승인과 rollback/복구 경로를 가진다. client bundle에 Supabase service role이나 Google Places 서버키가 발견되면 즉시 출시 중단/폐기/회전한다. 잘못 노출된 키를 저장소에서 삭제만 하는 것으로 해결됐다고 보지 않는다.

## 7. OTA 업데이트와 구버전 앱

EAS Update는 호환되는 runtime의 JS/asset 변경에 사용한다. 지도 SDK, 권한, config plugin, OS 연결 설정이 바뀌면 새 네이티브 빌드가 필요하다. runtimeVersion 정책을 명시하고 preview channel에서 검증 후 production으로 승격한다. [L11]

OTA로 앱 심사/정책을 우회하거나 새 네이티브 기능이 이미 있는 것처럼 배포하지 않는다. update ID/commit/runtime/binary를 연결해서 장애 시 이전 호환 업데이트로 rollback할 수 있게 한다. DB는 최소 직전 배포 앱 버전이 동작하는 확장형 migration을 유지하며, 서버 API의 오류/응답 계약을 갑자기 바꾸지 않는다.

## 8. 비용과 사업 검증

초기 앱에는 결제, 식당 광고, 예약 수수료를 구현하지 않는다. MAU만으로 매출을 추정하거나 Google Places 데이터를 판매할 수 있는 자산으로 취급하지 않는다. 향후 유료화를 할 때는 기능별 고객 가치, 현재 플랫폼 결제 규칙과 계약을 별도 검토한다.

우선 계측할 값은 `첫 10곳 저장 완료율`, `검색 후 저장/중복/미확인 비율`, `지역 링크 생성→비회원 열람→타인 저장 전환`, `7일/30일 재방문`, `사용자 1명당 실제 인프라 비용`이다. 실험 표본과 분모를 명시하며 본인 직접 열람/봇을 전환에서 제외한다.

Google Maps SDK/JS와 Places 각 SKU는 별도로 현재 요금/무료 사용량/과금 지역을 확인한다. 견적식은 `실제 호출량 × 해당 SKU 단가 + Supabase/호스팅/빌드/오류 수집 비용`이고 Places search/details/autocomplete를 한 단가로 합치지 않는다. 무료 한도를 넘기지 않을 것이라는 전제로 사업 계획을 만들지 않는다.

동의 기반의 최소 이벤트만 수집하고, 개인 저장 장소 전체를 분석 서비스에 보내지 않는다. 예를 들어 검색 후 저장 결과는 결과 코드, 공유 전환은 난수 이벤트 ID와 생성/열람/저장 상태로 집계한다. 장소 취향은 민감한 생활 패턴을 추론할 수 있으므로 공개 기본값을 수익화 목적으로 바꾸지 않는다.

## 9. 공개 직전 최종 게이트

- [ ] 정의된 요구사항과 테스트 항목의 실제 결과가 기록되어 있고 blocker가 없다.
- [ ] 양 플랫폼 production 서명 빌드에서 Google 지도/Google와 Apple 로그인/저장/공유/탈퇴가 작동한다.
- [ ] 앱이 없는 상대방도 지역 공유를 열 수 있고, 철회/만료/비공개가 즉시 서버에서 적용된다.
- [ ] 개인정보 문서/권한/SDK 신고/UGC 처리/외부 삭제 요청/지원 연락처가 공개되어 있다.
- [ ] API 비용 한도/키 제한/모니터링/Google 출처/보관 제한/백업 복구를 확인했다.
- [ ] 출시 국가와 스토어 계정별 요구를 확인했고, 심사 제출 및 공개 전 소유자 승인을 받았다.

M6의 최종 증거는 iOS/Android 공개 스토어 URL, 릴리스 버전/빌드 ID, 공개 국가, 승인/공개 일시, production smoke test 결과다. 베타까지만 끝났다면 `베타 완료`, 제출했으면 `심사 중`, 승인됐지만 미공개면 `승인/미공개`라고 적는다. 현재는 모두 NOT_STARTED다.

## 공식 근거

확인일: 2026-09-09. 아래 자료는 현재의 구현/심사 체크 근거이며 실제 제출 때 다시 확인한다.

[L1]: https://docs.expo.dev/build/introduction/
[L2]: https://docs.expo.dev/deploy/submit-to-app-stores/
[L3]: https://docs.expo.dev/linking/overview/
[L4]: https://firebase.google.com/support/dynamic-links-faq
[L5]: https://developer.apple.com/news/upcoming-requirements/
[L6]: https://support.google.com/googleplay/android-developer/answer/11926878?hl=en
[L7]: https://support.google.com/googleplay/android-developer/answer/14151465?hl=en
[L8]: https://developer.apple.com/app-store/review/guidelines/
[L9]: https://developer.apple.com/support/offering-account-deletion-in-your-app/
[L10]: https://support.google.com/googleplay/android-developer/answer/13327111?hl=en
[L11]: https://docs.expo.dev/eas-update/runtime-versions/
