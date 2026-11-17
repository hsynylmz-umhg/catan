import { useEffect } from 'react';
import { useStore } from './store';
import { useT, useThemeDef } from './hooks';
import { applyThemeVars } from './themes';
import { Home } from './screens/Home';
import { Lobby } from './screens/Lobby';
import { Game } from './screens/Game';
import { ReconnectBanner, Toasts } from './ui/common';
import { Ico } from './ui/Icons';

function ReplacedOverlay() {
  const t = useT();
  const { takeBack, leaveHome } = useStore();
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="replaced-title">
      <div className="overlay-card lacquer pattern">
        <span className="emblem" aria-hidden>
          <Ico name="link" size={30} />
        </span>
        <h2 id="replaced-title">{t('replaced.title')}</h2>
        <p>{t('replaced.text')}</p>
        <button className="btn primary big" onClick={takeBack}>
          {t('replaced.take')}
        </button>
        <button className="btn ghost" onClick={() => leaveHome(false)}>
          <Ico name="home" /> {t('menu.leave')}
        </button>
      </div>
    </div>
  );
}

export function App() {
  const theme = useThemeDef();
  const lang = useStore((s) => s.settings.lang);
  const room = useStore((s) => s.room);
  const view = useStore((s) => s.view);
  const replaced = useStore((s) => s.replaced);

  useEffect(() => applyThemeVars(theme), [theme]);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  let screen;
  if (!room) screen = <Home />;
  else if (room.status === 'lobby' || !view) screen = <Lobby room={room} />;
  else screen = <Game />;

  return (
    <>
      {screen}
      <ReconnectBanner />
      {replaced && <ReplacedOverlay />}
      <Toasts />
    </>
  );
}
