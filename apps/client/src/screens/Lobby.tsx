import { PLAYER_COLORS, type MapSize, type RoomInfo } from '@kervan/shared';
import { useStore } from '../store';
import { useT, useThemeDef } from '../hooks';
import { ThemePicker } from '../hud/Menu';
import { Ico, Star8 } from '../ui/Icons';
import { CodePlate } from '../ui/common';
import { SceneBackdrop } from '../ui/Scene';

export function Lobby({ room }: { room: RoomInfo }) {
  const t = useT();
  const theme = useThemeDef();
  const { seat, send, leaveHome, pushToast } = useStore();
  const isHost = seat === room.hostSeat;
  const n = room.members.length;
  const maxFor = (s: MapSize) => (s === 'standard' ? 4 : 6);
  const startBlock = n < 2 ? t('lobby.needMore') : n > maxFor(room.config.mapSize) ? t('lobby.tooMany') : null;
  const link = `${location.origin}/?room=${room.code}`;
  const taken = new Set(room.members.filter((m) => m.seat !== seat).map((m) => m.color));
  const myColor = room.members.find((m) => m.seat === seat)?.color;
  const free = Math.max(0, room.maxPlayers - n);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      pushToast({ kind: 'info', key: 'lobby.copied' });
    } catch {
      window.prompt('', link);
    }
  };
  const share = async () => {
    try {
      await navigator.share({ title: 'Kervan Yolu', text: t('lobby.shareText', { code: room.code }), url: link });
    } catch {
      /* cancelled */
    }
  };
  const cfg = (c: Partial<RoomInfo['config']>) => send({ t: 'config', config: c });

  return (
    <div className="home lobby">
      <SceneBackdrop theme={theme} dim />
      <div className="home-inner">
        <div className="home-top">
          <span className="brand-mark">
            <Star8 size={22} />
            {t('app.title')}
          </span>
          <button className="btn ghost small" onClick={() => leaveHome(true)}>
            {t('lobby.leave')}
          </button>
        </div>

        <div className="lobby-grid">
          <div className="lobby-col">
            <section className="lacquer code-panel" aria-labelledby="code-title">
              <div className="panel-body pattern">
                <span id="code-title" className="code-label">
                  {t('lobby.codeHint')}
                </span>
                <CodePlate code={room.code} />
                <div className="row-btns">
                  <button className="btn" onClick={copy}>
                    <Ico name="link" /> {t('lobby.copy')}
                  </button>
                  {typeof navigator.share === 'function' && (
                    <button className="btn" onClick={share}>
                      <Ico name="share" /> {t('lobby.share')}
                    </button>
                  )}
                </div>
              </div>
            </section>

            <section className="lacquer" aria-labelledby="players-title">
              <header className="panel-head strip">
                <h2 id="players-title">{t('lobby.players', { n, max: room.maxPlayers })}</h2>
              </header>
              <div className="panel-body">
                <ul className="banners">
                  {room.members.map((m) => (
                    <li key={m.seat} className="banner" style={{ ['--pc' as string]: m.color }}>
                      <span className="banner-flag" aria-hidden />
                      <span className="banner-name">{m.name}</span>
                      {m.seat === seat && <span className="tag gold">{t('common.you')}</span>}
                      {m.seat === room.hostSeat && <span className="tag">{t('common.host')}</span>}
                      <span className="grow" />
                      <span className={`conn-dot${m.connected ? ' on' : ''}`} title={m.connected ? '' : t('pl.offline')} />
                      {!m.connected && <span className="sr-only">{t('pl.offline')}</span>}
                    </li>
                  ))}
                  {Array.from({ length: free }, (_, i) => (
                    <li key={`free-${i}`} className="banner empty">
                      <span className="banner-flag" aria-hidden />
                      <span className="banner-name">{t('lobby.free')}</span>
                    </li>
                  ))}
                </ul>
                <div className="field">
                  <span>{t('lobby.color')}</span>
                  <div className="colors" role="radiogroup" aria-label={t('lobby.color')}>
                    {PLAYER_COLORS.map((c, i) => (
                      <button
                        key={c}
                        role="radio"
                        aria-checked={c === myColor}
                        className={`color-opt${c === myColor ? ' on' : ''}`}
                        style={{ background: c }}
                        disabled={taken.has(c)}
                        aria-label={t('lobby.colorN', { n: i + 1 })}
                        onClick={() => c !== myColor && send({ t: 'color', color: c })}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div className="lobby-col">
            <section className="lacquer" aria-labelledby="settings-title">
              <header className="panel-head strip">
                <h2 id="settings-title">{t('lobby.settings')}</h2>
                {!isHost && <span className="tag">{t('lobby.hostOnlyShort')}</span>}
              </header>
              <div className="panel-body">
                <div className="setting-row">
                  <span>{t('lobby.mapSize')}</span>
                  <div className="seg" role="group" aria-label={t('lobby.mapSize')}>
                    {(['standard', 'large'] as MapSize[]).map((s) => (
                      <button
                        key={s}
                        className={room.config.mapSize === s ? 'on' : ''}
                        aria-pressed={room.config.mapSize === s}
                        disabled={!isHost}
                        onClick={() => cfg({ mapSize: s, targetPoints: s === 'standard' ? 10 : 11 })}
                      >
                        {t(s === 'standard' ? 'lobby.standard' : 'lobby.large')}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="setting-row">
                  <span>{t('lobby.target')}</span>
                  <div className="stepper">
                    <button
                      className="step-btn"
                      aria-label={`${t('lobby.target')} −1`}
                      disabled={!isHost || room.config.targetPoints <= 8}
                      onClick={() => cfg({ targetPoints: room.config.targetPoints - 1 })}
                    >
                      −
                    </button>
                    <b aria-live="polite">{room.config.targetPoints}</b>
                    <button
                      className="step-btn"
                      aria-label={`${t('lobby.target')} +1`}
                      disabled={!isHost || room.config.targetPoints >= 14}
                      onClick={() => cfg({ targetPoints: room.config.targetPoints + 1 })}
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="field">
                  <span>{t('lobby.roomTheme')}</span>
                  <ThemePicker value={room.config.theme} onChange={(v) => v && cfg({ theme: v })} disabled={!isHost} />
                </div>
                {!isHost && <p className="muted small">{t('lobby.hostOnly')}</p>}
              </div>
            </section>

            <section className="start-zone lacquer">
              {isHost ? (
                <>
                  <button className="btn primary big wide" disabled={!!startBlock} onClick={() => send({ t: 'start' })}>
                    {t('lobby.start')}
                  </button>
                  {startBlock && <p className="warn small center">{startBlock}</p>}
                </>
              ) : (
                <p className="wait-host">
                  <span className="spinner" aria-hidden /> {t('lobby.waitHost')}
                </p>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
