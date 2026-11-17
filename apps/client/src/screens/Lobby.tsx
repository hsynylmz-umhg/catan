import { PLAYER_COLORS, type MapSize, type RoomInfo } from '@kervan/shared';
import { useStore } from '../store';
import { useLang, useT } from '../hooks';
import { THEMES, THEME_IDS } from '../themes';
import { Ico } from '../ui/Icons';

export function Lobby({ room }: { room: RoomInfo }) {
  const t = useT();
  const lang = useLang();
  const { seat, send, leaveHome, pushToast } = useStore();
  const isHost = seat === room.hostSeat;
  const n = room.members.length;
  const maxFor = (s: MapSize) => (s === 'standard' ? 4 : 6);
  const startBlock = n < 2 ? t('lobby.needMore') : n > maxFor(room.config.mapSize) ? t('lobby.tooMany') : null;
  const link = `${location.origin}/?room=${room.code}`;
  const taken = new Set(room.members.filter((m) => m.seat !== seat).map((m) => m.color));
  const myColor = room.members.find((m) => m.seat === seat)?.color;

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
      <div className="home-inner">
        <section className="card code-card">
          <div className="band" />
          <span className="muted">{t('lobby.title')}</span>
          <div className="code-big">{room.code}</div>
          <div className="row-btns">
            <button className="btn" onClick={copy}>
              <Ico name="copy" /> {t('lobby.copy')}
            </button>
            {typeof navigator.share === 'function' && (
              <button className="btn" onClick={share}>
                <Ico name="share" /> {t('lobby.share')}
              </button>
            )}
          </div>
        </section>

        <section className="card">
          <h2>{t('lobby.players', { n, max: room.maxPlayers })}</h2>
          <ul className="members">
            {room.members.map((m) => (
              <li key={m.seat} style={{ ['--pc' as string]: m.color }}>
                <i className="pl-dot big" />
                <b>{m.name}</b>
                {m.seat === seat && <span className="pl-you">{t('common.you')}</span>}
                {m.seat === room.hostSeat && <span className="chip">{t('common.host')}</span>}
                <span className="grow" />
                <span className={`conn-dot${m.connected ? ' on' : ''}`} title={m.connected ? '' : t('pl.offline')} />
              </li>
            ))}
          </ul>
          <h3>{t('lobby.color')}</h3>
          <div className="colors">
            {PLAYER_COLORS.map((c) => (
              <button
                key={c}
                className={`color-opt${c === myColor ? ' on' : ''}`}
                style={{ background: c }}
                disabled={taken.has(c)}
                aria-label={c}
                onClick={() => c !== myColor && send({ t: 'color', color: c })}
              />
            ))}
          </div>
        </section>

        <section className="card">
          <h2>{t('lobby.settings')}</h2>
          {!isHost && <p className="muted small">{t('lobby.hostOnly')}</p>}
          <div className="menu-row">
            <span>{t('lobby.mapSize')}</span>
            <div className="seg">
              {(['standard', 'large'] as MapSize[]).map((s) => (
                <button
                  key={s}
                  className={room.config.mapSize === s ? 'on' : ''}
                  disabled={!isHost}
                  onClick={() => cfg({ mapSize: s, targetPoints: s === 'standard' ? 10 : 11 })}
                >
                  {t(s === 'standard' ? 'lobby.standard' : 'lobby.large')}
                </button>
              ))}
            </div>
          </div>
          <div className="menu-row">
            <span>{t('lobby.target')}</span>
            <div className="stepper">
              <button className="step-btn" disabled={!isHost || room.config.targetPoints <= 8} onClick={() => cfg({ targetPoints: room.config.targetPoints - 1 })}>
                −
              </button>
              <b>{room.config.targetPoints}</b>
              <button className="step-btn" disabled={!isHost || room.config.targetPoints >= 14} onClick={() => cfg({ targetPoints: room.config.targetPoints + 1 })}>
                +
              </button>
            </div>
          </div>
          <div>
            <h3>{t('lobby.roomTheme')}</h3>
            <div className="theme-picker">
              {THEME_IDS.map((id) => (
                <button key={id} className={`theme-opt${room.config.theme === id ? ' on' : ''}`} disabled={!isHost} onClick={() => cfg({ theme: id })}>
                  <span
                    className="swatch"
                    style={{ background: `linear-gradient(135deg, ${THEMES[id].ui.accent} 0 34%, ${THEMES[id].palette.sea} 34% 67%, ${THEMES[id].palette.terrain.field} 67%)` }}
                  />
                  {THEMES[id].label[lang]}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="card">
          {isHost ? (
            <>
              <button className="btn primary big wide" disabled={!!startBlock} onClick={() => send({ t: 'start' })}>
                {t('lobby.start')}
              </button>
              {startBlock && <p className="warn small center">{startBlock}</p>}
            </>
          ) : (
            <p className="center muted">
              <span className="spinner" /> {t('lobby.waitHost')}
            </p>
          )}
          <button className="btn ghost wide" onClick={() => leaveHome(true)}>
            {t('lobby.leave')}
          </button>
        </section>
      </div>
    </div>
  );
}
