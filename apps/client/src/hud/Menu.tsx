import type { PlayerView, RoomInfo, ThemeId } from '@kervan/shared';
import { useStore } from '../store';
import { useLang, useNames, useT } from '../hooks';
import type { Key } from '../i18n';
import { THEMES, THEME_IDS, type Lang, type PieceKind } from '../themes';
import { CostView, Ico } from '../ui/Icons';
import { Sheet } from '../ui/common';

export function LangSwitch() {
  const lang = useLang();
  const setSetting = useStore((s) => s.setSetting);
  return (
    <div className="seg" role="group">
      {(['tr', 'en'] as Lang[]).map((l) => (
        <button key={l} className={lang === l ? 'on' : ''} onClick={() => setSetting('lang', l)}>
          {l === 'tr' ? 'Türkçe' : 'English'}
        </button>
      ))}
    </div>
  );
}

/** Local theme override picker ("room theme" = follow the room). */
export function ThemePicker({ value, onChange, allowAuto }: { value: ThemeId | null; onChange: (v: ThemeId | null) => void; allowAuto?: boolean }) {
  const lang = useLang();
  const t = useT();
  return (
    <div className="theme-picker">
      {allowAuto && (
        <button className={`theme-opt${value === null ? ' on' : ''}`} onClick={() => onChange(null)}>
          <span className="swatch auto" />
          {t('home.themeAuto')}
        </button>
      )}
      {THEME_IDS.map((id) => {
        const th = THEMES[id];
        return (
          <button key={id} className={`theme-opt${value === id ? ' on' : ''}`} onClick={() => onChange(id)}>
            <span className="swatch" style={{ background: `linear-gradient(135deg, ${th.ui.accent} 0 34%, ${th.palette.sea} 34% 67%, ${th.palette.terrain.field} 67%)` }} />
            {th.label[lang]}
          </button>
        );
      })}
    </div>
  );
}

export function CostCard() {
  const t = useT();
  const names = useNames();
  const rows: PieceKind[] = ['road', 'outpost', 'keep', 'market'];
  return (
    <div className="cost-card">
      {rows.map((k) => (
        <div key={k}>
          <span>{names.piece(k)}</span>
          <CostView item={k} />
        </div>
      ))}
      <div>
        <span>{t('cost.card', { decree: names.decree })}</span>
        <CostView item="card" />
      </div>
    </div>
  );
}

export function RulesSummary({ target }: { target: number }) {
  const t = useT();
  const names = useNames();
  const vars = {
    target,
    outpost: names.piece('outpost'),
    keep: names.piece('keep'),
    market: names.piece('market'),
    road: names.piece('road'),
    bandit: names.bandit,
    raider: names.card('raider'),
  };
  return (
    <ol className="rules">
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <li key={i}>{t(`rules.${i}` as Key, vars)}</li>
      ))}
    </ol>
  );
}

export function MenuDialog({ view, room, isHost, onClose }: { view: PlayerView; room: RoomInfo | null; isHost: boolean; onClose: () => void }) {
  const t = useT();
  const { settings, setSetting, send, leaveHome } = useStore();
  const status = room?.status;
  return (
    <Sheet title={t('menu.title')} onClose={onClose} wide>
      <div className="menu-grid">
        {room && (
          <div className="menu-row">
            <span>{t('menu.room')}</span>
            <b className="code-inline">{room.code}</b>
          </div>
        )}
        {isHost && (status === 'playing' || status === 'paused') && (
          <button
            className="btn primary"
            onClick={() => {
              send({ t: status === 'paused' ? 'unpause' : 'pause' });
              onClose();
            }}
          >
            <Ico name={status === 'paused' ? 'play' : 'pause'} /> {t(status === 'paused' ? 'menu.resume' : 'menu.pause')}
          </button>
        )}
        <div className="menu-row">
          <span>{t('home.language')}</span>
          <LangSwitch />
        </div>
        <div className="menu-row">
          <span>{t('menu.sound')}</span>
          <div className="seg">
            <button className={!settings.muted ? 'on' : ''} onClick={() => setSetting('muted', false)}>
              {t('menu.soundOn')}
            </button>
            <button className={settings.muted ? 'on' : ''} onClick={() => setSetting('muted', true)}>
              {t('menu.soundOff')}
            </button>
          </div>
        </div>
        <div className="menu-row">
          <span>{t('menu.board')}</span>
          <div className="seg">
            <button className={settings.boardMode === '3d' ? 'on' : ''} onClick={() => setSetting('boardMode', '3d')}>
              {t('menu.board3d')}
            </button>
            <button className={settings.boardMode === '2d' ? 'on' : ''} onClick={() => setSetting('boardMode', '2d')}>
              {t('menu.board2d')}
            </button>
          </div>
        </div>
        <div>
          <h3>{t('home.theme')}</h3>
          <ThemePicker value={settings.themeOverride} onChange={(v) => setSetting('themeOverride', v)} allowAuto />
        </div>
        <details open>
          <summary>{t('menu.costs')}</summary>
          <CostCard />
        </details>
        <details>
          <summary>{t('menu.rules')}</summary>
          <RulesSummary target={view.config.targetPoints} />
        </details>
        <div>
          <button className="btn ghost" onClick={() => leaveHome(false)}>
            <Ico name="home" /> {t('menu.leave')}
          </button>
          <p className="muted small">{t('menu.leaveHint')}</p>
        </div>
      </div>
    </Sheet>
  );
}

export function PausedOverlay({ room, isHost }: { room: RoomInfo; isHost: boolean }) {
  const t = useT();
  const { send, leaveHome } = useStore();
  return (
    <div className="overlay">
      <div className="overlay-card">
        <div className="band" />
        <Ico name="pause" size={34} />
        <h2>{t('paused.title')}</h2>
        <p>{t('paused.text', { code: room.code })}</p>
        <div className="code-big small">{room.code}</div>
        {isHost ? (
          <button className="btn primary big" onClick={() => send({ t: 'unpause' })}>
            <Ico name="play" /> {t('menu.resume')}
          </button>
        ) : (
          <p className="muted">{t('paused.waitHost')}</p>
        )}
        <button className="btn ghost" onClick={() => leaveHome(false)}>
          <Ico name="home" /> {t('menu.leave')}
        </button>
      </div>
    </div>
  );
}

export function FinishedOverlay({ view, onHide }: { view: PlayerView; onHide: () => void }) {
  const t = useT();
  const leaveHome = useStore((s) => s.leaveHome);
  const winner = view.players.find((p) => p.seat === view.winner);
  const sorted = [...view.players].sort((a, b) => (b.totalPoints ?? b.publicPoints) - (a.totalPoints ?? a.publicPoints));
  return (
    <div className="overlay">
      <div className="overlay-card">
        <div className="band" />
        <div className="winner" style={{ ['--pc' as string]: winner?.color ?? 'var(--accent)' }}>
          <Ico name="star" size={40} />
        </div>
        <h2>{view.winner !== null && view.winner === view.you ? t('fin.youWon') : t('fin.title', { name: winner?.name ?? '?' })}</h2>
        <h3>{t('fin.scores')}</h3>
        <ol className="scores">
          {sorted.map((p) => (
            <li key={p.seat} className={p.seat === view.winner ? 'win' : ''} style={{ ['--pc' as string]: p.color }}>
              <i className="pl-dot" />
              <span>{p.name}</span>
              <b>{p.totalPoints ?? p.publicPoints}</b>
            </li>
          ))}
        </ol>
        <button className="btn primary big" onClick={() => leaveHome(false)}>
          <Ico name="home" /> {t('fin.home')}
        </button>
        <button className="btn ghost" onClick={onHide}>
          {t('fin.viewBoard')}
        </button>
      </div>
    </div>
  );
}
