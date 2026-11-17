import { useEffect, useState } from 'react';
import type { FinishedGame, RoomSummary } from '@kervan/shared';
import { urlRoomCode, useStore } from '../store';
import { loadSeats, removeSeat, type SavedSeat } from '../storage';
import { useLang, useT } from '../hooks';
import type { Key } from '../i18n';
import { LangSwitch, ThemePicker } from '../hud/Menu';
import { Ico } from '../ui/Icons';

type Saved = SavedSeat & { info?: RoomSummary; failed?: boolean };

export function Home() {
  const t = useT();
  const lang = useLang();
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

  return (
    <div className="home">
      <div className="home-inner">
        <header className="hero">
          <div className="hero-mark" aria-hidden>
            <img src="/icon.svg" alt="" width={72} height={72} />
          </div>
          <h1>{t('app.title')}</h1>
          <p>{t('app.tagline')}</p>
        </header>

        <section className="card">
          <div className="band" />
          <label className="field">
            <span>{t('home.name')}</span>
            <input value={name} maxLength={20} placeholder={t('home.namePh')} onChange={(e) => setName(e.target.value)} autoComplete="nickname" />
          </label>
          <button className="btn primary big wide" disabled={busy} onClick={onCreate}>
            {busy ? t('home.connecting') : t('home.create')}
          </button>
          <div className="join-row">
            <input
              className="code-input"
              value={code}
              maxLength={5}
              placeholder={t('home.codePh')}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && onJoin()}
              autoCapitalize="characters"
              spellCheck={false}
            />
            <button className="btn" disabled={busy} onClick={onJoin}>
              {t('home.join')}
            </button>
          </div>
        </section>

        <section className="card">
          <h2>{t('home.myGames')}</h2>
          {saved.length === 0 ? (
            <p className="muted">{t('home.noGames')}</p>
          ) : (
            <ul className="saved">
              {saved.map((s) => (
                <li key={s.code}>
                  <div className="saved-main">
                    <b className="code-inline">{s.code}</b>
                    {s.info && <span className={`status-pill st-${s.info.status}`}>{t(`status.${s.info.status}` as Key)}</span>}
                    <small className="muted">
                      {s.info ? s.info.players.join(', ') : s.name}
                      {s.info && s.info.turn > 0 && ` · ${t('home.turnN', { n: s.info.turn })}`}
                    </small>
                  </div>
                  <button className="btn small primary" disabled={busy} onClick={() => resumeRoom(s.code, s.token)}>
                    {t('home.resume')}
                  </button>
                  <button
                    className="icon-btn"
                    aria-label={t('home.forget')}
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

        <section className="card">
          <h2>{t('home.recent')}</h2>
          {recent === null ? (
            <p className="muted">{t('common.loading')}</p>
          ) : recent.length === 0 ? (
            <p className="muted">{t('home.noRecent')}</p>
          ) : (
            <ul className="recent">
              {recent.map((g) => (
                <li key={`${g.code}-${g.finishedAt}`}>
                  <span className="muted small">{fmtDate(g.finishedAt)}</span>
                  <span>
                    <Ico name="star" size={13} /> <b>{g.winner}</b>
                  </span>
                  <small className="muted">
                    {g.players.map((p) => `${p.name} ${p.points}`).join(' · ')} · {t('home.turns', { n: g.turns })}
                  </small>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card settings">
          <div className="menu-row">
            <span>{t('home.language')}</span>
            <LangSwitch />
          </div>
          <div>
            <h3>{t('home.theme')}</h3>
            <ThemePicker value={settings.themeOverride} onChange={(v) => setSetting('themeOverride', v)} allowAuto />
          </div>
        </section>
      </div>
    </div>
  );
}
