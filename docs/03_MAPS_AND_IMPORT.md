# 03. Google 지도, 저장목록 가져오기와 국제 지역

버전 2.0 | 공식 자료 확인일 2026-09-09 | 실제 사용자 Takeout/실기기/API 호출은 아직 검증하지 않음

## 1. 먼저 구분할 네 가지

| 기능 | 제공 수단 | 이 제품의 결정 |
|---|---|---|
| 지도 표시 | Google Maps SDK for iOS/Android | 양 플랫폼 Google provider 채택 |
| 음식점 검색/상세 | Google Places API (New) | 서버에서 제한적으로 호출 |
| 앱에 Google 계정으로 로그인 | Google OAuth + Supabase Auth | 계정 인증용이며 저장목록 조회 권한이 아님 |
| Google 개인 저장목록 이전 | Takeout 또는 조건부 Data Portability API | P0 Takeout, P1 승인된 계정 연결 |

Google Maps SDK/Places API를 쓴다고 소비자 Google Maps 앱의 개인 저장목록이 자동 공개되지 않는다. 지도 API 키도 Google 사용자의 권한 토큰이 아니다. 이 서비스는 앱 안에서 개인 목록을 만들고 공유하며, Google Maps의 리뷰/지도/길찾기를 복제해 독립 지도 원천으로 판매하는 제품이 아니다. [M1][M2]

## 2. Google 가져오기: 지원 약속

### P0: Google Takeout 파일 가져오기

Google은 계정 데이터 사본을 Takeout으로 내려받아 제3자 서비스로 직접 옮기는 경로를 안내한다. 이 제품은 사용자가 선택한 저장목록 파일을 앱의 파일 선택기로 받고, 자동 파싱/후보 연결/일괄 확인으로 수동 재저장을 줄인다. 원래 Google 저장은 바꾸거나 삭제하지 않는다. [M3]

앱 문구는 `Google 저장목록 파일 가져오기`다. `Google 로그인 한 번이면 모든 저장을 즉시 동기화`가 아니다. 내보내기 준비 시간은 Google이 결정하므로 우리 앱의 빠른 처리와 Google 내보내기 대기를 구분한다.

UX는 `Google Takeout에서 필요한 저장 데이터만 선택 → 내보내기 파일 수신 → Files/다운로드에서 선택 → 목록/지역 확인 → 가져오기`다. 계정/언어에 따라 Saved/저장됨/Maps 관련 항목과 실제 파일 구성이 달라질 수 있어 화면의 이름 하나나 ZIP 경로 하나에 의존하지 않는다. 전체 Google 계정 아카이브를 요구하지 않는다.

### P1: 승인된 Google 계정 연결 가져오기

공식 Data Portability API에는 `saved.collections`가 있다. Google Search/Maps 등의 저장 링크, 장소와 컬렉션을 옮기는 범위이며 일반 로그인과 별도 동의를 받는다. [M4]

하지만 2026-09-09 공식 지원 목록은 유럽 일부 국가를 대상으로 하며 한국과 미국은 포함하지 않는다. 지원 국가에서도 조직 관리, 미성년, 보호 설정 등에 따라 안 될 수 있다. 앱에서 선택한 여행 국가나 GPS만으로 계정의 이용 가능성을 판정하지 않는다. [M3]

이 기능은 첫 출시에서 `FEATURE_GOOGLE_PORTABILITY=false`로 둔다. 지원 지역 계정/승인된 OAuth client/취소/재연결을 검증한 뒤만 켠다. 한 번 또는 30/180일 동의가 가능하다는 사실을 실시간 양방향 동기화로 표현하지 않는다. [M5]

구현 시 로그인용 openid/email/profile과 DPAPI scope를 같은 동의 요청에 섞지 않는다. `include_granted_scopes=true`도 사용하지 않는다. DPAPI 토큰으로 계정 이메일을 알 수 있다고 가정하지 않고, 이미 로그인한 앱 사용자의 서버 intent에 일회용 state/PKCE를 묶는다. [M5]

현재 `dataportability.saved.collections`는 Sensitive로 분류된다. 모든 경우에 Restricted 심사와 유료 보안평가가 필수라고 단정하지 않는다. 실제 요청 범위의 브랜드/동의 화면/검증 요건을 적용한다. 전송 아카이브 URL과 토큰은 서버 비밀로 취급하고 만료/철회를 처리한다. [M4][M6]

### 하지 않을 우회

Google 비밀번호/쿠키/개발자 도구 인증값 수집, 자동 로그인, 비공개 RPC, Playwright로 개인 목록 스크래핑, CAPTCHA 우회, 공용 목록 DOM 대량 추출을 구현하지 않는다. Google 목록 공유 링크는 표준 일괄 JSON API가 아니므로 가져오기 파일과 같은 입력으로 처리하지 않는다.

## 3. 입력 포맷과 파서 계약

| 포맷 | P0 상태 | 처리 |
|---|---|---|
| Takeout ZIP의 저장목록 CSV | 필수 | 해당 파일만 선택/파싱. 파일별 개인 폴더 복원 |
| 저장목록 CSV 단독/여러 파일 | 필수 | UTF-8/BOM, 따옴표/줄바꿈/설명행 지원 |
| 앱 자체 export JSON v1 | 필수 | 개인 기록 복원. 공개범위는 private로 초기화 |
| Google 장소 URL/공유 text | 필수 | 단일 장소 확인 파이프라인 |
| legacy Saved Places JSON/GeoJSON | P1 또는 실제 fixture 확인 후 추가 | 형식 버전/좌표 의미 검증 전 지원하지 않는다고 표시 |
| Google My Maps KML/KMZ | P1 | 소비자 Google Maps 저장목록과 다른 제품임을 안내 |
| Google Timeline/사진/리뷰/다른 사람 목록 | 미지원 | 저장 이력으로 오인하지 않고 제외 |

공식 Saved 스키마는 CSV의 제목, URL, 메모, 태그, 코멘트를 설명한다. 컬렉션 설명이 첫 행, 다음 행이 빈 행인 파일도 가능하다. 모든 데이터에 좌표가 들어 있다고 보장하지 않는다. 이 스키마는 실제 모든 Takeout 버전의 헤더/경로를 보장하는 계약이 아니므로, 개인정보 제거한 실제 내보내기 fixture를 별도로 검증해야 한다. [M7]

파서는 파일명을 고정하지 않고 헤더/객체 구조를 검증한다. 알려진 필드 별칭 예: `title/Title`, `item_content_url/URL`, `note/Note`, `tags/Tags`, `comment/Comment`. 모르는 현지화 헤더는 사용자 컬럼 매핑 또는 미지원 안내로 처리한다. 비슷해 보이는 칼럼을 추측해 확정하지 않는다.

정규화 결과 계약:

```ts
type ImportedRow = {
  sourceRowKey: string;       // 파일 내 행의 안정적 키, 로컬/해당 사용자 범위
  sourceKind: 'takeout_saved_csv' | 'app_json_v1' | 'google_url';
  collectionName?: string;   // 개인 폴더
  inputTitle?: string;       // 입력 원문 라벨, 공개 장소명으로 자동 사용하지 않음
  inputUrl?: string;
  ownNote?: string;
  inputTags?: string[];
  explicitRegionId?: string; // 사용자가 앱 카탈로그에서 선택
  explicitPlaceId?: string;  // 표준 URL 등에 있는 값, 서버 검증 전 신뢰하지 않음
};
```

사용자 작성 note는 개인 메모로 보존한다. 작성자를 알 수 없는 collection comment나 공유자의 글은 자동으로 내 공개 설명에 넣지 않는다. 같은 장소가 여러 목록에 있고 note가 다르면 출처별 `imported_notes`를 개인 기록으로 보존하며 기존 personal_note를 덮어쓰지 않는다.

## 4. 가져오기 파이프라인

```text
기기에서 파일 선택
→ 파일/압축 한도 검사
→ 저장 관련 파일 선택
→ 파싱과 목록 미리보기
→ 개인 데이터/제외 항목 확인
→ 정규화 행만 private batch로 업로드
→ Place ID 검증 또는 이름+사용자가 선택한 지역으로 후보 검색
→ 사용자가 후보/지역을 확인
→ 20행 이하 단위 commit
→ 새 저장/기존 중복/미해결/제외/실패 결과
```

P0 운영 한도 초안: 압축 파일 25 MiB, 실제 압축해제 합계 100 MiB, 파일 1,000개, CSV 한 파일 5 MiB, 선택 행 한 batch 1,000개. 최소 지원 기기 테스트와 예상 API 비용으로 조정하고 04에 변경 사유를 남긴다. 전체 ZIP을 메모리에 풀어놓는 동기 unzip을 쓰지 않는다.

확장자/MIME만 믿지 않는다. 실제 읽은 바이트로 한도를 검사하고 zip bomb, 중첩 압축, 암호화 ZIP, 경로 탈출, 절대경로, symlink, 과도한 행 길이를 거부한다. 선택하지 않은 메일/사진/검색 기록은 업로드하거나 파싱하지 않는다. 임시 기기 파일은 취소/완료/최대 7일 후 삭제하고 OS 백업 대상에서 제외한다.

| 상태 | 의미 |
|---|---|
| parsed | 형식 검증은 완료, 아직 장소 확인 전 |
| needs_review | 후보가 있거나 다른 지점/지역 확인 필요 |
| ready | 사용자가 장소와 입력을 확인한 상태 |
| saved | 새 내 저장 생성 |
| duplicate | 기존 내 저장 참조, 폴더 연결만 추가 가능 |
| unresolved | 확정 불가. 검색 수정/건너뛰기/비공개 미해결 기록 유지 |
| skipped | 사용자가 제외하거나 지원 대상이 아님 |
| failed | 재시도 가능한 오류 또는 명시된 영구 오류 |

ready는 클라이언트 플래그를 그대로 신뢰하지 않는다. 서버가 후보 ticket/Place ID/현재 사용자/입력 해시를 재검증한다. 단일 후보도 사용자의 확인을 받는다. 같은 나라의 동명 프랜차이즈를 이름만 보고 자동 병합하지 않는다.

파일 파싱 성공과 장소 매칭 성공을 별도 집계한다. `1,000행 파싱, 620곳 연결, 200곳 중복, 130곳 확인 필요, 50곳 제외`처럼 설명한다. 병원/집/회사 주소 같은 비식음료 항목은 기본 미선택이며 식당 후보로 위장해 공개하지 않는다.

commit은 batchId+sourceRowKey 및 userId+placeRefId로 멱등성을 보장한다. 기존 메모/방문 상태/공개범위는 보존한다. 같은 원본 파일 재가져오기는 기존 폴더를 연결하되 파일명만 같다는 이유로 서로 다른 목록을 합치지 않는다. Google 측 삭제를 감지했다고 앱의 저장을 자동 삭제하지 않는다.

미완료 batch는 7일 유지하고 완료/취소 시 더 이상 필요 없는 원문을 제거한다. 이미 확정한 개인 저장은 batch 정리로 삭제하지 않는다. 가져오기 중 앱 종료 후 서버 상태부터 재조회한다. 만료 시 로컬 원본 파일을 다시 선택해 멱등 재시도한다.

## 5. Google 링크를 실제 장소에 연결하는 규칙

공식 Maps URLs의 문서화된 query_place_id가 있으면 Place Details로 검증한다. 소비자 URL 안의 `cid`, `!1s0x...`, 지도 카메라 `@lat,lng`를 Place ID나 장소 좌표로 임의 변환하지 않는다. URL에 장소명이 있더라도 지점 일치까지 확인한다. [M8]

짧은 링크는 서버의 명시된 Google Maps 링크 host/path allowlist에서만 제한적으로 redirect를 따라간다. 각 hop마다 HTTPS, 포트, 사용자정보 없음, DNS 재확인, private/loopback/link-local/metadata IP 차단, 최대 3 hops/시간/응답 바이트 한도를 적용한다. 광범위한 `*.google.com` 허용이나 임의 사이트 proxy는 만들지 않는다.

HTTP redirect로 해결되지 않으면 웹페이지 HTML/내부 JS를 파싱해 비공개 데이터를 추출하지 않는다. 사용자에게 Google에서 열기, 장소명/지역 수정 후 검색을 제공한다. 알려진 장소 ID가 없으면 `inputTitle + explicitRegion`로 후보를 찾아 확인한다. 단순 주소/좌표 geocoding만으로 정확한 가게가 식별됐다고 주장하지 않는다.

보안상 서버 redirect 해석을 운영 승인하지 못한 환경에서는 해당 어댑터를 끄되, 입력을 잃지 않고 검색 확인으로 이어지게 한다. 입력 경로별 해결률과 수동 수정 비율을 측정한다.

## 6. Google API 데이터 저장 정책

Google Places 정책은 place_id의 장기 저장 예외를 명시하며, API 콘텐츠 일반의 선취/캐싱/저장을 제한한다. 비EEA 서비스별 약관은 Places의 위도/경도에 최대 연속 30일의 임시 캐시를 허용한다. **모든 장소 정보가 30일 동안 저장 가능하다는 뜻이 아니다.** 청구 주소가 EEA이면 다른 약관도 검토한다. [M1][M2]

| 데이터 | 기본 처리 | 공개/내보내기 |
|---|---|---|
| Google Place ID | 장기 저장 허용 예외에 따라 저장 | 사용자 저장 연결에 사용 |
| 내 저장 관계/메모/태그/폴더/사용자가 고른 지역 | 자체 사용자 데이터로 영구 관리 | 메모/폴더는 private, 사용자가 고른 필드만 export |
| Google API 장소명/주소/영업시간/평점/유형 | 현재 화면 응답과 메모리에서만 사용. DB/디스크/분석 로그 저장 금지 | 정책에 맞는 live 표시만. 일괄 export 금지 |
| Google API 좌표 | 기본 메모리. 승인 후 7일 TTL의 제한된 서버 캐시 | Google 지도 표시용. 영구 dump/내보내기 금지 |
| 좌표에서 만든 geohash/지역 인덱스 | Google 위치 캐시와 동일 수명 | 영구 저장으로 우회하지 않음 |
| Takeout 입력 라벨/URL | 개인 이전 데이터, provenance/사용자 선택 기록 | 자동 공공 장소 DB로 합치지 않음. 공개 표시는 live Places로 보강 |
| 실제 사용자 작성 note | 사용자 개인 기록 | 명시적 별도 작성/공개 선택 없이는 타인에게 안 보임 |
| Google 사진/리뷰 | P0 미수집 | 외부 Google 페이지에서 보기 |

Takeout 소비자 내보내기는 GMP API 응답과 다른 경로다. 사용자의 이전 동의는 개인 기록 처리 근거이지 Google 콘텐츠를 공공 카탈로그로 재판매하는 포괄 라이선스가 아니다. 실제 파일의 필드별 원천/개인 이용/공개 재배포 조건을 M0에서 검토한다. 법률 검토가 필요한 쟁점을 임의로 합법 확정하지 않는다.

API에서 받은 장소명을 user_label에 자동 복사하거나 Google 검색 결과를 사용자에게 재입력시키는 방식으로 저장 제한을 우회하지 않는다. 공개 지도는 Place ID와 자체 공개 설명을 보관하고, Google 장소명 등은 열람 시 불러온다. 지역 필터용 영구 데이터도 독립 원천 또는 사용자의 독립적인 카탈로그 선택을 따른다.

좌표 DB 캐시를 켜려면 운영 저장소뿐 아니라 자동 백업/다운로드 dump/크래시 로그까지 합쳐 원 API 조회 후 30일 안에 사본이 사라짐을 증명해야 한다. 설계 기본은 캐시 7일, 물리 백업 보관 최대 7일이며 만료 삭제 작업을 감시한다. 보존 범위 확인 전 `GOOGLE_COORD_CACHE_ENABLED=false`로 메모리 처리한다. 비용 최적화를 이유로 금지된 영구 저장을 하지 않는다.

Place ID도 변동 가능하다. Google은 오래된 ID의 갱신을 안내한다. 유효성 확인 시 replacement ID를 연결하고, 같은 사용자의 중복 기록을 메모 손실 없이 처리한다. 실패한 조회를 곧바로 폐업 확정으로 표시하지 않는다. [M9]

## 7. 지도/검색 비용과 성능

지도 표시와 Places 상세/검색 호출은 별도 사용량이다. 무료 지도 노출이 가능하더라도 Places와 기타 비용까지 무료라고 쓰지 않는다. 현재 가격표의 실제 SKU/요금지역/요청 필드로 산정한다. [M10]

Google API 요청은 서버가 고정 FieldMask를 선택한다. `*`는 금지한다. 검색 자동완성은 사용자 입력 debounce, 오래된 요청 취소, session token 재사용 범위를 적용하고 선택 시 동일 세션을 종료한다. 필드에 따라 SKU가 달라지므로 `displayName`도 무조건 저렴한 필드라고 가정하지 않는다. [M11][M12]

화면별 초기 예산:

- 검색 후보 최대 5개, 목록 페이지 20개, 동일 화면 상세 갱신 동시 요청 최대 4개.
- 지도 핀은 저장 ID를 기준으로 필요한 좌표만 읽는다. 좌표 미확인 대량 저장을 한 번에 전부 상세 조회하지 않는다.
- 좌표 캐시가 없거나 만료됐으면 20개씩 점진 조회하며 `위치 확인 20/200`을 표시한다. 지금 보이는 지역/페이지부터 처리하고 중단할 수 있다.
- 전 세계 수천 핀을 처음부터 모두 표시하지 않는다. 지역 필터/현재 지도 범위와 cluster를 사용한다. 목록과 지도 일부만 로딩된 상태를 구분한다.
- 열람할 권한이 없는 private 저장에 대해 Google 요청을 먼저 하지 않는다.

무료로 가져오기 버튼을 반복 호출해 유료 API 요청을 무한히 발생시키지 못하게 user/batch/IP 단위 요청 수, 시간당 비용, 일일 총액 제한을 둔다. Cloud 예산 알림을 실시간 hard cap으로 취급하지 않는다. 제한에 도달해도 개인 저장/파일/메모를 잃지 않고 새 Google 요청만 중단한다.

Maps SDK/웹 지도의 저작자 표시를 UI가 덮지 않도록 검증한다. Google 지도 없이 목록만 보여줄 때도 필요한 Google Maps attribution을 표시한다. 리뷰/사진을 후속 추가하면 저자/출처 표시 조건을 다시 적용한다. [M1]

## 8. 국제 지역 모델

국가는 코드로, 지역은 `parent_id`가 있는 가변 깊이 노드로 관리한다. 한국 시/도/구/동, 미국 주/도시/자치구, 일본 도도부현/시구정을 한 번역 문자열로 단순 매핑하지 않는다.

초기 독립 지역 카탈로그는 GeoNames의 국가/행정구역/도시 데이터로 구성하고, 출시 지역에서 부족한 하위 구역은 이용조건을 확인한 공식 지역 자료로 보강한다. GeoNames는 attribution을 요구하고 정확성/완전성을 보장하지 않으므로 버전/출처/검증 결과를 기록한다. 모든 세계 동네 경계를 확보한 것으로 광고하지 않는다. [M13]

초기에는 폴리곤 전체 적재를 필수로 하지 않는다. 사용자 지역 선택은 카탈로그 기반, 지도 범위 검색은 현재 유효한 좌표 기반이다. `서울숲` 같은 생활권은 독립적인 운영 분류로 별도 kind를 쓴다. 지역 입력은 사용자 최근 선택을 제안할 수 있지만 Google 주소 자동 가공 결과를 영구 카탈로그로 만들지 않는다.

Takeout의 `Tokyo food` 폴더를 가져올 때 앱 지역 선택기에서 Tokyo를 한 번 선택해 선택 행에 적용할 수 있다. 폴더 이름을 해석해 모든 장소를 도쿄로 자동 확정하지 않는다. 틀린 경우 행별 해제가 가능해야 한다.

국제 지도 테스트는 좌표 순서 lng/lat, 경도 ±180, 위도 범위, 날짜변경선 bbox 분리, 한국/영문/일본어/악센트, 동명 도시, 단계 누락, 여러 생활권 소속을 포함한다. 현재 위치 권한이 없을 때도 국가 검색이 가능해야 한다.

Google의 API/SDK 제공 범위와 데이터 품질은 국가/기능별로 다르다. 전 세계 동일 품질, 중국 본토 연결성, 모든 기기의 Google 서비스 사용을 보장하지 않는다. 공개 대상 국가별 실제 기기/네트워크 검증과 이용약관 검토를 통과해야 한다. [M14]

## 9. 내보내기 계약

JSON v1에는 schemaVersion, exportedAt, savedPlaces, collections를 담는다. savedPlaces에는 appRecordId, googlePlaceId?, ownLabel?, ownNotes?, tags, visitStatus, visitedOn?, ownRegionIds, originalUserUrl?를 담는다. 폴더 연결은 appRecordId로 표현한다.

공개범위는 기록용으로 담을 수 있지만 재가져올 때 무조건 private로 초기화한다. API로 가져온 장소명/주소/좌표/리뷰/사진, 다른 사람의 메모, OAuth 정보, 공유 secret/hash, 내부 운영 필드는 넣지 않는다. Takeout의 제한된 원문 필드는 원천 정책 확인 전 export whitelist에 넣지 않는다. 사용자가 원본 파일을 보관하도록 안내한다.

CSV는 수식으로 해석되는 =,+,-,@ 및 선행 공백/탭/CR을 방어하고 따옴표/줄바꿈을 escape한다. 원문 복원이 필요한 개인 기록은 JSON을 제공한다. 파일은 공개 Storage에 놓지 않고 단말의 보호된 임시 파일에서 공유/저장한 뒤 앱 사본을 삭제한다.

## 공식 근거

[M1]: https://developers.google.com/maps/documentation/places/web-service/policies
[M2]: https://cloud.google.com/maps-platform/terms/maps-service-terms
[M3]: https://support.google.com/accounts/answer/14452558?hl=en
[M4]: https://developers.google.com/data-portability/user-guide/scopes
[M5]: https://developers.google.com/data-portability/user-guide/configure-oauth
[M6]: https://developers.google.com/data-portability/user-guide/overview
[M7]: https://developers.google.com/data-portability/schema-reference/save
[M8]: https://developers.google.com/maps/documentation/urls/get-started
[M9]: https://developers.google.com/maps/documentation/places/web-service/place-id
[M10]: https://developers.google.com/maps/documentation/places/web-service/usage-and-billing
[M11]: https://developers.google.com/maps/documentation/places/web-service/choose-fields
[M12]: https://developers.google.com/maps/documentation/places/web-service/using-session-tokens
[M13]: https://www.geonames.org/export/
[M14]: https://developers.google.com/maps/coverage
