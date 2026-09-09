import './App.css';

const foundations = ['권한 확인', '지도·목록', '앱으로 열기'];

export default function App() {
  return (
    <main className="shell">
      <header className="masthead">
        <a className="wordmark" href="/" aria-label="LiveToEat 홈">
          LiveToEat
        </a>
        <span className="mode">SHARE WEB · M0</span>
      </header>

      <section className="hero" aria-labelledby="share-title">
        <div className="route" aria-hidden="true">
          <span className="route__point route__point--start" />
          <span className="route__line" />
          <span className="route__point route__point--end" />
        </div>
        <p className="eyebrow">공유 화면의 안전한 출발점</p>
        <h1 id="share-title">
          좋아하는 장소는
          <br />
          링크 하나로 이어집니다.
        </h1>
        <p className="lede">
          지금은 공유 웹의 기반만 준비된 상태입니다. 실제 장소는 공유 권한을 서버에서 확인한 뒤에만 표시합니다.
        </p>
      </section>

      <section className="foundation" aria-label="공유 웹 기반 구성">
        {foundations.map((item, index) => (
          <div className="foundation__item" key={item}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{item}</strong>
            <em>기반 준비됨</em>
          </div>
        ))}
      </section>

      <footer>공유 비밀값은 URL fragment에서 읽고 서버 요청 본문으로만 전송합니다.</footer>
    </main>
  );
}
