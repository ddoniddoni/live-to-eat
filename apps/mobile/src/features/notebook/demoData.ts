import type { Notebook, NotebookPlace } from '@live-to-eat/domain';

const regions = {
  seongsu: [
    { id: 'kr', label: '대한민국' },
    { id: 'seoul', label: '서울' },
    { id: 'seongsu', label: '성수' },
  ],
  yeonnam: [
    { id: 'kr', label: '대한민국' },
    { id: 'seoul', label: '서울' },
    { id: 'yeonnam', label: '연남' },
  ],
  seochon: [
    { id: 'kr', label: '대한민국' },
    { id: 'seoul', label: '서울' },
    { id: 'seochon', label: '서촌' },
  ],
  gwangan: [
    { id: 'kr', label: '대한민국' },
    { id: 'busan', label: '부산' },
    { id: 'suyeong', label: '수영구' },
    { id: 'gwangan', label: '광안동' },
  ],
  busanCentral: [
    { id: 'kr', label: '대한민국' },
    { id: 'busan', label: '부산' },
    { id: 'busan-jung', label: '중구' },
  ],
  jeju: [
    { id: 'kr', label: '대한민국' },
    { id: 'jeju', label: '제주' },
    { id: 'seogwipo', label: '서귀포시' },
  ],
};
const sample = (
  id: string,
  name: string,
  region: keyof typeof regions,
  tags: string[],
  visited = false,
  folder: string | null = null,
): NotebookPlace => ({
  savedId: `demo-${id}`,
  displayName: name,
  address: `${regions[region].map((r) => r.label).join(' · ')} · 예시 장소`,
  coordinate: null,
  regionPath: regions[region],
  tags,
  visitStatus: visited ? 'visited' : 'want',
  visibility: 'private',
  collectionId: folder,
  collectionName: folder === 'weekend' ? '주말의 식탁' : folder === 'coffee' ? '커피 한 잔' : null,
  note: '',
  publicNote: '',
  isRecommended: false,
  version: 1,
});
export const demoCatalog: NotebookPlace[] = [
  {
    ...sample('table', '오후의 식탁', 'seongsu', ['파스타', '데이트'], true, 'weekend'),
    isRecommended: true,
    note: '레몬 버터 파스타. 다음엔 창가에 앉아야지.',
  },
  sample('coffee', '온도 커피', 'yeonnam', ['커피', '조용한'], false, 'coffee'),
  {
    ...sample('bakery', '모퉁이 베이커리', 'seochon', ['베이커리', '브런치'], true, 'weekend'),
    note: '일찍 가면 따뜻한 빵을 만날 수 있다.',
  },
  // New domestic examples use new IDs. Existing saved foreign examples remain untouched.
  sample('busan-noodle', '바다 곁 국수', 'gwangan', ['국수', '혼밥']),
  sample('wine', '작은 와인바', 'seongsu', ['와인', '저녁'], false, 'weekend'),
  { ...sample('rice', '한 그릇', 'seochon', ['한식', '점심'], true), isRecommended: true },
  sample('dessert', '계절의 조각', 'yeonnam', ['디저트', '카페']),
  sample('busan-coffee', '파도 커피', 'gwangan', ['커피', '카페']),
  sample('busan-bakery', '항구 베이커리', 'busanCentral', ['베이커리', '브런치']),
  sample('jeju-coffee', '귤빛 커피', 'jeju', ['커피', '카페'], false, 'coffee'),
  sample('jeju-rice', '돌담 한 상', 'jeju', ['한식', '점심']),
];
export const createDemoNotebook = (): Notebook => ({
  version: 1,
  places: demoCatalog.filter((p) => ['demo-table', 'demo-coffee', 'demo-bakery', 'demo-busan-noodle', 'demo-wine', 'demo-jeju-coffee'].includes(p.savedId)).map(p => Object.assign({}, p)),
  collections: [
    { id: 'weekend', name: '주말의 식탁' },
    { id: 'coffee', name: '커피 한 잔' },
  ],
  shares: [],
  blockedHandles: [],
  profile: { displayName: '나의 맛있는 기록', bio: '좋아하는 한 끼를 차곡차곡.', publicMapEnabled: false },
  locale: 'ko',
  welcomed: false,
});
export const demoPeople = [
  {
    handle: 'sujin_eats',
    displayName: '수진',
    bio: '한 끼를 먹어도, 오래 기억할 곳으로.',
    region: 'seoul',
    regionLabel: '서울',
    theme: 'blush',
    initial: '수',
    ids: ['demo-table', 'demo-wine', 'demo-dessert'],
  },
  {
    handle: 'crumbs_minho',
    displayName: '민호',
    bio: '커피와 빵을 따라 걷는 주말.',
    region: 'seoul',
    regionLabel: '서울',
    theme: 'sage',
    initial: '민',
    ids: ['demo-coffee', 'demo-bakery'],
  },
  {
    handle: 'bada_busan',
    displayName: '바다',
    bio: '바닷바람을 따라, 한 끼와 커피 한 잔.',
    region: 'busan',
    regionLabel: '부산',
    theme: 'lavender',
    initial: '바',
    ids: ['demo-busan-noodle', 'demo-busan-coffee', 'demo-busan-bakery', 'demo-jeju-rice'],
  },
  {
    handle: 'jeju_slow',
    displayName: '여름',
    bio: '돌담길 산책 끝에 만나는 작은 식탁.',
    region: 'jeju',
    regionLabel: '제주',
    theme: 'sage',
    initial: '여',
    ids: ['demo-jeju-coffee', 'demo-jeju-rice'],
  },
] as const;
export const emptyNotebook = (): Notebook => ({
  ...createDemoNotebook(),
  places: [],
  collections: [],
  profile: { displayName: '', bio: '', publicMapEnabled: false },
  welcomed: true,
});
