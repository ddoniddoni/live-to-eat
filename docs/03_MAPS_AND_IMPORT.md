# 03. Google 지도, 장소 검색과 국제 지역

버전 2.1 | 기준일 2026-09-10 | 상태: 지도와 Places 검색 구현·실계정/API 호출은 미검증

## 1. 제품 경계

| 영역 | LiveToEat에서 하는 일 | 하지 않는 일 |
|---|---|---|
| 앱 지도 | iOS/Android에서 `react-native-maps`의 Google provider로 현재 저장과 검색 결과를 표시 | Apple Maps로 조용히 대체하거나 지도 타일을 자체 저장 |
| 장소 입력 | 인증된 서버가 Google Places API (New)를 호출해 사용자가 선택할 후보를 제공 | 검색 외 외부 데이터 입력이나 대량 동기화 |
| 로그인 | Google/Apple로 앱 계정을 인증 | Google 계정의 지도·저장목록 읽기 권한 요청 |

Google 지도 SDK와 Google Places API는 국제 장소 탐색을 위한 제공자다. 장소는 사용자가 검색 결과에서 직접 선택해 저장하며, 검색 외 입력이나 외부 목록 동기화는 제공하지 않는다.

## 2. 지도 표시

앱 지도는 iOS와 Android 모두 `PROVIDER_GOOGLE`을 사용한다. 개발·preview·store 서명마다 필요한 제한 키를 구분하고, 키는 package/bundle ID와 서명 인증서 및 허용 API로 제한한다. 지도 키와 서버 Places 키를 하나로 합치지 않는다. [M1][M2]

지도가 실패해도 사용자의 개인 목록과 장소 저장 흐름은 사용할 수 있어야 한다. 지도 화면은 다음을 명시적으로 구분한다.

- 내 저장만 표시한다. 타인의 저장은 둘러보기·상대방 지도·허용된 공유 링크에서만 표시한다.
- 좌표가 없는 개인 저장은 목록에서 보이되 지도 핀으로 추측해 표시하지 않는다.
- 현재 위치는 선택 기능이다. 권한 거절·대략 위치·오프라인에서는 마지막 선택 지역 또는 목록 화면으로 대체한다.
- Google 로고, 저작자 표시와 SDK 고지 영역을 가리거나 비슷한 자체 표기로 대체하지 않는다.

## 3. Places 검색과 저장

검색은 사용자가 입력한 상호 또는 지역으로 시작한다. 서버는 요청자, 입력 길이, 호출 수, 응답 개수를 검증하고 고정된 FieldMask로 최대 필요한 후보만 반환한다. 검색 결과는 선택을 돕는 짧은 수명 ticket과 함께 내려주며, 저장 시 서버가 ticket의 소유자·만료·단일 사용 여부를 확인한다.

```text
사용자 검색어 입력
→ Edge Function의 Places Text Search (New)
→ 제한된 후보 DTO와 Google attribution
→ 사용자가 장소·지역을 확인
→ private/want 기본값으로 저장
```

검색 결과에서 자동 저장하지 않는다. 동명이점, 이전·폐업, 음식점이 아닌 장소, 주소가 불완전한 결과는 사용자가 확인하거나 취소할 수 있어야 한다. Places 장애·쿼터·키 오류는 재시도 가능한 안내를 보여주며, 이미 저장한 개인 기록을 삭제하지 않는다.

### 서버 데이터 계약

클라이언트가 받는 후보는 선택에 필요한 최소 DTO로 제한한다.

```ts
type PlaceSearchCandidate = {
  placeId: string;
  displayName: string;
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  attribution: 'google';
  searchTicket: string;
};
```

실제 DB에는 provider Place ID와 사용자 작성 기록을 분리한다. 장소명·주소·평점·리뷰·사진 같은 Google 응답을 별도 공공 카탈로그나 장기 백업으로 복제하지 않는다. 공개 지도·공유 웹에서 필요한 경우에도 live Places 응답과 제공자 정책을 따르며, 보관 가능한 데이터와 수명을 운영 전에 다시 검토한다. [M9][M10]

## 4. 비용, 보안과 장애 대응

Google Maps SDK/JavaScript API와 Places search/details/autocomplete는 서로 다른 SKU다. 비용 판단은 실제 호출량과 현재 계약의 SKU별 가격을 기준으로 하고, 무료 한도나 개발 키 기준으로 출시 비용을 약속하지 않는다.

- 요청/계정/IP 기준 rate limit, 짧은 timeout, 응답 개수 상한과 서버 kill switch를 둔다.
- 서버 Places 키와 Supabase service role은 앱 번들·클라이언트 로그·오류 화면에 넣지 않는다.
- 사용자의 전체 검색어, 개인 메모, 정확한 주소, 좌표, access/refresh token을 분석·오류 이벤트에 넣지 않는다.
- 지도 또는 Places 장애에는 목록 중심 UI와 오류 상태를 제공한다. 자동 재시도로 비용을 증폭하지 않는다.

장소 정보는 사용자 자신의 기록과 제공자 응답을 구분한다. 사용자가 쓴 메모·태그·방문 상태·선택 지역은 LiveToEat 데이터지만, Google 응답을 재판매·자체 검색 인덱스·무기한 백업으로 바꾸는 근거가 되지 않는다.

## 5. 국제 지역 모델

지역은 단순한 한글 행정동 문자열이 아니다. `region_nodes`와 `region_closure`로 국가별 가변 깊이 트리를 표현하고, 표시 이름은 locale별 데이터로 둔다.

```text
대한민국 → 서울 → 성동구 → 성수동
미국 → New York → New York City → Manhattan
일본 → 東京都 → 渋谷区
```

위는 UI 예시일 뿐 전 세계의 보편 스키마가 아니다. 누락된 단계는 건너뛰고, 같은 이름은 국가·상위 지역·source key로 구분한다. 생활권처럼 행정구역과 다른 항목도 별도 노드로 지원한다.

장소에 지역을 붙일 때는 사용자가 선택한 지역과 독립 자료로 확인한 지역을 구분한다. 주소가 불완전하거나 후보가 모호하면 임의의 국가·도시·좌표를 확정하지 않는다. `지역 미분류` 목록에서 나중에 직접 지정할 수 있어야 하며, 지역 필터와 지도 화면 범위는 같은 조건이 아니다.

## 6. 내 데이터 내보내기

내보내기는 본인이 작성한 기록을 JSON/CSV로 제공하는 단방향 기능이다. private 메모 포함 여부를 파일 생성 전에 설명하고, CSV 수식 주입을 막는다. Google Places API에서 받은 제한 콘텐츠, 다른 사람의 개인 메모, OAuth 정보, 공유 secret/hash, 운영 필드는 파일에 넣지 않는다.

내보낸 파일을 앱에서 복원하는 기능은 제품 범위가 아니다. 사용자는 파일을 자신의 저장소에서 관리한다.

## 공식 근거

확인일: 2026-09-09. 출시·키 설정·데이터 보관 정책을 변경할 때 공식 문서를 다시 확인한다.

[M1]: https://docs.expo.dev/versions/latest/sdk/map-view/
[M2]: https://developers.google.com/maps/api-security-best-practices
[M9]: https://developers.google.com/maps/documentation/places/web-service/policies
[M10]: https://developers.google.com/maps/documentation/places/web-service/text-search
