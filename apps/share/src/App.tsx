import { useEffect, useRef, useState, type ReactNode } from 'react';
import './App.css';

type Language = 'ko' | 'en';
const copy = {
  ko: {
    share: '공유 지도',
    language: 'English',
    home: '좋아하는 곳을,\n좋아하는 사람에게.',
    intro: 'LiveToEat에서 고른 장소를 링크 하나로 함께 살펴보세요. 앱이 없어도 괜찮아요.',
    how: '공유받은 링크로 열어주세요',
    howBody: '지역과 장소를 고른 지도가 이곳에 펼쳐집니다. 나만의 지도는 LiveToEat 앱에서 만들 수 있어요.',
    sample: '예시 지도 살펴보기',
    demo: '예시 지도 · 실제 공유가 아닙니다',
    title: '서울에서, 느긋한 주말',
    bio: '수진이 고른 천천히 머물고 싶은 곳들',
    region: '대한민국 · 서울',
    count: '장소 3곳',
    private: '개인 메모와 방문 기록은 공유되지 않아요.',
    list: '장소 목록',
    map: '지도',
    mapHint: '지도 연결 전에는 아래 장소 목록을 살펴보세요.',
    by: '수진의 지도',
    more: '장소 살펴보기',
    close: '닫기',
    about: '사람을 통해 발견하는 맛집 지도',
    expired: '이 지도는 더 이상 열 수 없어요',
    expiredBody: '공유 기간이 끝났거나 작성자가 공유를 철회했어요. 새로운 링크를 요청해 주세요.',
    invalid: '공유 링크를 확인해 주세요',
    invalidBody: '링크가 일부 빠졌거나 올바르지 않아요. 전달받은 전체 링크를 다시 열어 주세요.',
    connection: '지금은 지도를 열 수 없어요',
    connectionBody: '공유 서비스에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.',
    retry: '다시 시도',
    back: 'LiveToEat 알아보기',
    samplePlace: '직접 만든 예시 장소',
    note: '창가에 앉아 천천히 한 끼를 즐기기 좋은 곳이에요.',
    illustration: '지도 일러스트',
    privacy: '공개범위 안내',
    privacyBody:
      '작성자가 선택한 장소만 표시됩니다. 링크는 다른 사람에게 전달될 수 있습니다. 개인 메모, 태그, 방문 기록과 폴더 이름은 공개하지 않습니다.',
  },
  en: {
    share: 'Shared map',
    language: '한국어',
    home: 'Places you love.\nPeople you love.',
    intro: 'Explore a handpicked map from LiveToEat with just a link. No app required.',
    how: 'Open a link shared with you',
    howBody: 'A selection of places will appear here. Create your own map in the LiveToEat app.',
    sample: 'Explore a sample map',
    demo: 'Sample map · Not a real share',
    title: 'A slow weekend in Seoul',
    bio: 'Places to linger, handpicked by Sujin',
    region: 'South Korea · Seoul',
    count: '3 places',
    private: 'Personal notes and visit history stay private.',
    list: 'Places',
    map: 'Map',
    mapHint: 'Explore the list below while the map is disconnected.',
    by: 'Sujin’s map',
    more: 'Explore this place',
    close: 'Close',
    about: 'A food map discovered through people',
    expired: 'This map is no longer available',
    expiredBody: 'The share has expired or the creator has revoked it. Ask them for a new link.',
    invalid: 'Check your share link',
    invalidBody: 'The link is incomplete or invalid. Try opening the full link you received.',
    connection: 'This map can’t load right now',
    connectionBody: 'We couldn’t connect to the sharing service. Please try again later.',
    retry: 'Try again',
    back: 'About LiveToEat',
    samplePlace: 'Fictional sample place',
    note: 'A lovely place to sit by the window and enjoy a slow meal.',
    illustration: 'Map illustration',
    privacy: 'About privacy',
    privacyBody:
      'Only the creator’s selected places appear. Links can be forwarded. Personal notes, tags, visit records and folder names are never included.',
  },
};
const places = [
  {
    name: '오후의 식탁',
    en: 'Afternoon Table',
    area: '성수 · 파스타',
    areaEn: 'Seongsu · Pasta',
    kind: 'plate',
  },
  { name: '온도 커피', en: 'Ondo Coffee', area: '연남 · 커피', areaEn: 'Yeonnam · Coffee', kind: 'coffee' },
  {
    name: '모퉁이 베이커리',
    en: 'Corner Bakery',
    area: '서촌 · 베이커리',
    areaEn: 'Seochon · Bakery',
    kind: 'bread',
  },
];
export default function App() {
  const [language, setLanguage] = useState<Language>('ko');
  const [selected, setSelected] = useState<number | null>(null);
  const [privacy, setPrivacy] = useState(false);
  const [view, setView] = useState<'list' | 'map'>('list');
  const t = copy[language];
  const pathname = window.location.pathname;
  const isSample = import.meta.env.DEV && new URLSearchParams(window.location.search).get('preview') === '1';
  const forcedExpired = isSample && new URLSearchParams(window.location.search).get('state') === 'expired';
  const shareRoute = /^\/s\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/?$/i.test(pathname);
  const publicRoute = /^\/u\/[a-z0-9_]{3,30}\/?$/.test(pathname);
  const validSecret = /^#k=[A-Za-z0-9_-]{43}$/.test(window.location.hash);
  const state = forcedExpired
    ? 'expired'
    : isSample
      ? 'sample'
      : pathname === '/'
        ? 'home'
        : publicRoute || (shareRoute && validSecret)
          ? 'connection'
          : 'invalid';
  useEffect(() => {
    document.documentElement.lang = language;
    document.title = `LiveToEat · ${copy[language].share}`;
  }, [language]);
  return (
    <main className="shell">
      <header className="masthead">
        <a className="wordmark" href="/" aria-label="LiveToEat">
          LiveToEat<span> ·</span>
        </a>
        <button
          className="language"
          onClick={() => setLanguage((l) => (l === 'ko' ? 'en' : 'ko'))}
          lang={language === 'ko' ? 'en' : 'ko'}
        >
          {t.language}
        </button>
      </header>
      {state === 'home' ? (
        <>
          <section className="welcome">
            <div className="brand-art" aria-hidden="true">
              <span className="plate">
                <i />
                <i />
                <i />
              </span>
              <span className="pin">♡</span>
            </div>
            <p className="eyebrow">PEOPLE, PLACES & TASTE</p>
            <h1>{t.home}</h1>
            <p className="lede">{t.intro}</p>
          </section>
          <section className="invite">
            <span className="invite-icon" aria-hidden="true">
              ↗
            </span>
            <div>
              <h2>{t.how}</h2>
              <p>{t.howBody}</p>
            </div>
          </section>
          {import.meta.env.DEV ? (
            <a className="button" href="/?preview=1">
              {t.sample}
              <span aria-hidden="true">→</span>
            </a>
          ) : null}
        </>
      ) : state === 'sample' ? (
        <>
          <div className="demo-label">{t.demo}</div>
          <section className="map-heading">
            <p className="eyebrow">{t.region}</p>
            <h1>{t.title}</h1>
            <p className="lede">{t.bio}</p>
            <div className="byline">
              <span className="avatar" aria-hidden="true">
                S
              </span>
              <strong>{t.by}</strong>
              <span>{t.count}</span>
            </div>
          </section>
          <div className="illustrated-map" role="img" aria-label={t.illustration}>
            <i className="river" />
            <i className="street street-a" />
            <i className="street street-b" />
            <i className="street street-c" />
            <span className="map-pin one">1</span>
            <span className="map-pin two">2</span>
            <span className="map-pin three">3</span>
            <small>{t.illustration}</small>
          </div>
          <div className="list-toolbar">
            <h2>{t.count}</h2>
            <div className="segments">
              <button aria-pressed={view === 'list'} onClick={() => setView('list')}>
                {t.list}
              </button>
              <button aria-pressed={view === 'map'} onClick={() => setView('map')}>
                {t.map}
              </button>
            </div>
          </div>
          {view === 'map' ? (
            <p className="notice" role="status">
              {t.mapHint}
            </p>
          ) : null}
          <ol className="places">
            {places.map((place, index) => (
              <li key={place.kind}>
                <button
                  className="place"
                  onClick={() => setSelected(index)}
                  aria-label={`${language === 'ko' ? place.name : place.en} · ${t.more}`}
                >
                  <div className={`food ${place.kind}`} aria-hidden="true">
                    <svg viewBox="0 0 100 100">
                      <use href={`/food.svg#${place.kind}`} />
                    </svg>
                  </div>
                  <div className="place-text">
                    <h3>{language === 'ko' ? place.name : place.en}</h3>
                    <p>{language === 'ko' ? place.area : place.areaEn}</p>
                    <small>{t.samplePlace}</small>
                  </div>
                  <span aria-hidden="true">↗</span>
                </button>
              </li>
            ))}
          </ol>
          <p className="privacy-hint">{t.private}</p>
        </>
      ) : (
        <section className="error-state" aria-labelledby="error-heading">
          <div className="error-icon" aria-hidden="true">
            {state === 'expired' ? '◷' : '↗'}
          </div>
          <p className="eyebrow">{t.share}</p>
          <h1 id="error-heading">{t[state]}</h1>
          <p className="lede">{t[`${state}Body`]}</p>
          {state === 'connection' ? (
            <button className="button" onClick={() => window.location.reload()}>
              {t.retry}
            </button>
          ) : null}
          <a className="text-link" href="/">
            {t.back} →
          </a>
        </section>
      )}
      <footer>
        <span>LiveToEat · {t.about}</span>
        <button onClick={() => setPrivacy(true)}>{t.privacy}</button>
      </footer>
      {selected !== null || privacy ? (
        <DetailDialog
          closeLabel={t.close}
          onClose={() => {
            setSelected(null);
            setPrivacy(false);
          }}
        >
          <p className="eyebrow">{privacy ? t.privacy : t.samplePlace}</p>
          <h2 id="detail-title">
            {privacy
              ? t.privacy
              : selected !== null
                ? language === 'ko'
                  ? places[selected]?.name
                  : places[selected]?.en
                : ''}
          </h2>
          <p>{privacy ? t.privacyBody : t.note}</p>
        </DetailDialog>
      ) : null}
    </main>
  );
}

function DetailDialog({
  children,
  closeLabel,
  onClose,
}: {
  children: ReactNode;
  closeLabel: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby="detail-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <button className="dialog-close" onClick={onClose} aria-label={closeLabel}>
        ×
      </button>
      {children}
    </dialog>
  );
}
