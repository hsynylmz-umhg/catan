import { useEffect, useState } from 'react';
import type { FinishedGame, RoomSummary } from '@kervan/shared';
import { urlRoomCode, useStore } from '../store';
import { loadSeats, removeSeat, type SavedSeat } from '../storage';
import { useLang, useT, useThemeDef } from '../hooks';
import type { Key } from '../i18n';
import { LangSwitch, ThemeDots } from '../hud/Menu';
import { Ico, Star8 } from '../ui/Icons';
import { SceneBackdrop } from '../ui/Scene';

type Saved = SavedSeat & { info?: RoomSummary; failed?: boolean };

export function Home() {
  const t = useT();
  const lang = useLang();
  const theme = useThemeDef();
  const { settings, setSetting, createRoom, joinRoom, resumeRoom, conn, pushToast } = useStore();
  const [name, setName] = useState(settings.name);
  const [code, setCode] = useState(() => urlRoomCode() ?? '');
  const [saved, setSaved] = useState<Saved[]>(() => loadSeats());
  const [recent, setRecent] = useState<FinishedGame[] | null>(null);
  const busy = conn === 'connecting';

  useEffect(() => {
    let alive = true;
    const seats = loadSeats();
    void Promise.all(
      seats.map(async (s): Promise<Saved | null> => {
        try {
          const r = await fetch(`/api/rooms/${encodeURIComponent(s.code)}`);
          if (r.status === 404) {
            removeSeat(s.code);
            return null;
          }
          if (!r.ok) return { ...s, failed: true };
          return { ...s, info: (await r.json()) as RoomSummary };
        } catch {
          return { ...s, failed: true };
        }
      }),
    ).then((list) => alive && setSaved(list.filter((x): x is Saved => !!x)));
    fetch('/api/history?limit=8')
      .then((r) => (r.ok ? (r.json() as Promise<FinishedGame[]>) : []))
      .then((h) => alive && setRecent(Array.isArray(h) ? h : []))
      .catch(() => alive && setRecent([]));
    return () => {
      alive = false;
    };
  }, []);

  const keepName = () => {
    const n = name.trim().slice(0, 20);
    if (!n) {
      pushToast({ kind: 'info', key: 'home.needName' });
      return null;
    }
    setSetting('name', n);
    return n;
  };
  const onCreate = () => {
    const n = keepName();
    if (n) createRoom(n);
  };
  const onJoin = () => {
    const c = code.trim().toUpperCase();
    if (c.length !== 5) return pushToast({ kind: 'info', key: 'home.needCode' });
    const n = keepName();
    if (n) joinRoom(c, n);
  };
  const fmtDate = (ts: number) => new Date(ts).toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-GB', { day: 'numeric', month: 'short' });

  const [first, second] = t('app.title').split(' ');

  return (
    <div className="home">
      <SceneBackdrop theme={theme} />
      <div className="home-inner">
        <div className="home-top">
          <span className="brand-mark" aria-hidden>
            <Star8 size={22} />
          </span>
          <div className="switches">
            <LangSwitch mini />
            <ThemeDots />
          </div>
        </div>

        <div className="home-cols">
          <div className="home-col">
            <header className="hero">
              <h1 className="hero-title" aria-label={t('app.title')}>
                <span>{first}</span>
                {second && <span>{second}</span>}
              </h1>
              <div className="hero-rule rule" aria-hidden>
                <Star8 size={14} />
              </div>
              <p className="hero-tag">{t('app.tagline')}</p>
            </header>

            <div className="hero-gap" />

            <section className="home-panel lacquer" aria-label={t('home.create')}>
              <div className="panel-body">
                <label className="field">
                  <span>{t('home.name')}</span>
                  <input value={name} maxLength={20} placeholder={t('home.namePh')} onChange={(e) => setName(e.target.value)} autoComplete="nickname" />
                </label>
                <button className="btn primary big wide" disabled={busy} onClick={onCreate}>
                  {busy ? (
                    <>
                      <span className="spinner" aria-hidden /> {t('home.connecting')}
                    </>
                  ) : (
                    t('home.create')
                  )}
                </button>
                <div className="rule or-rule">{t('home.or')}</div>
                <div className="join-row">
                  <input
                    className="code-input"
                    value={code}
                    maxLength={5}
                    placeholder={t('home.codePh')}
                    aria-label={t('home.codePh')}
                    onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                    onKeyDown={(e) => e.key === 'Enter' && onJoin()}
                    autoCapitalize="characters"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button className="btn" disabled={busy} onClick={onJoin}>
                    {t('home.join')}
                  </button>
                </div>
              </div>
            </section>

            <div className="home-lists">
              <section className="quiet">
                <h2>
                  <Star8 size={12} />
                  {t('home.myGames')}
                </h2>
                {saved.length === 0 ? (
                  <p>{t('home.noGames')}</p>
                ) : (
                  <ul className="saved">
                    {saved.map((s) => (
                      <li key={s.code}>
                        <div className="saved-main">
                          <div className="saved-head">
                            <b className="code-inline">{s.code}</b>
                            {s.info && <span className={`status-pill st-${s.info.status}`}>{t(`status.${s.info.status}` as Key)}</span>}
                            {s.info && s.info.turn > 0 && <span className="muted small">{t('home.turnN', { n: s.info.turn })}</span>}
                          </div>
                          <small>{s.info ? s.info.players.join(', ') : s.name}</small>
                        </div>
                        <button className="btn small" disabled={busy} onClick={() => resumeRoom(s.code, s.token)}>
                          {t('home.resume')}
                        </button>
                        <button
                          className="icon-btn"
                          aria-label={`${t('home.forget')} ${s.code}`}
                          title={t('home.forget')}
                          onClick={() => {
                            removeSeat(s.code);
                            setSaved((l) => l.filter((x) => x.code !== s.code));
                          }}
                        >
                          <Ico name="close" size={16} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="quiet">
                <h2>
                  <Star8 size={12} />
                  {t('home.recent')}
                </h2>
                {recent === null ? (
                  <p>{t('common.loading')}</p>
                ) : recent.length === 0 ? (
                  <p>{t('home.noRecent')}</p>
                ) : (
                  <ul className="recent">
                    {recent.map((g) => (
                      <li key={`${g.code}-${g.finishedAt}`}>
                        <span className="recent-date">{fmtDate(g.finishedAt)}</span>
                        <span className="recent-win">
                          <Star8 size={13} />
                          {g.winner}
                        </span>
                        <span className="recent-turns">{t('home.turns', { n: g.turns })}</span>
                        <span className="recent-scores">
                          {g.players.map((p) => (
                            <span key={p.name}>
                              {p.name}
                              <b>{p.points}</b>
                            </span>
                          ))}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
