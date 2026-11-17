import type { PlayerView, RoomInfo, ThemeId } from '@kervan/shared';
import { useStore } from '../store';
import { useLang, useNames, useT } from '../hooks';
import type { Key } from '../i18n';
import { THEMES, THEME_IDS, type Lang, type PieceKind, type ThemeDef } from '../themes';
import { CostView, Ico, Star8 } from '../ui/Icons';
import { CodePlate, Sheet } from '../ui/common';

export function LangSwitch({ mini }: { mini?: boolean }) {
  const lang = useLang();
  const t = useT();
  const setSetting = useStore((s) => s.setSetting);
  return (
    <div className={`seg${mini ? ' mini' : ''}`} role="group" aria-label={t('home.language')}>
      {(['tr', 'en'] as Lang[]).map((l) => (
        <button key={l} className={lang === l ? 'on' : ''} aria-pressed={lang === l} onClick={() => setSetting('lang', l)} lang={l}>
          {mini ? l.toUpperCase() : l === 'tr' ? 'Türkçe' : 'English'}
        </button>
      ))}
    </div>
  );
}

const swatchBg = (th: ThemeDef) => `conic-gradient(from 200deg, ${th.ui.gold} 0 30%, ${th.ui.accent2} 0 55%, ${th.palette.terrain.forest} 0 75%, ${th.ui.panel} 0)`;

function TileSwatch({ th }: { th: ThemeDef }) {
  return (
    <span className="tile-swatch" aria-hidden>
      <i style={{ background: th.ui.panel }} />
      <i style={{ background: th.ui.gold }} />
      <i style={{ background: th.palette.sea }} />
      <i style={{ background: th.palette.terrain.field }} />
    </span>
  );
}

/** Theme tiles. `value === null` means "follow the room theme" (only offered when allowAuto). */
export function ThemePicker({
  value,
  onChange,
  allowAuto,
  disabled,
}: {
  value: ThemeId | null;
  onChange: (v: ThemeId | null) => void;
  allowAuto?: boolean;
  disabled?: boolean;
}) {
  const lang = useLang();
  const t = useT();
  return (
    <div className="theme-tiles" role="radiogroup" aria-label={t('home.theme')}>
      {allowAuto && (
        <button role="radio" aria-checked={value === null} className={`theme-tile${value === null ? ' on' : ''}`} disabled={disabled} onClick={() => onChange(null)}>
          <span className="tile-swatch" aria-hidden style={{ background: 'conic-gradient(#e0b354 0 33%, #2fa39a 0 66%, #d94bc8 0)' }} />
          {t('home.themeAuto')}
        </button>
      )}
      {THEME_IDS.map((id) => (
        <button key={id} role="radio" aria-checked={value === id} className={`theme-tile${value === id ? ' on' : ''}`} disabled={disabled} onClick={() => onChange(id)}>
          <TileSwatch th={THEMES[id]} />
          {THEMES[id].label[lang]}
        </button>
      ))}
    </div>
  );
}

/** Compact theme switch for the home top bar: three round swatches. */
export function ThemeDots() {
  const lang = useLang();
  const t = useT();
  const value = useStore((s) => s.settings.themeOverride);
  const setSetting = useStore((s) => s.setSetting);
  const current = value ?? 'anatolia';
  return (
    <div className="theme-dots" role="radiogroup" aria-label={t('home.theme')}>
      {THEME_IDS.map((id) => (
        <button
          key={id}
          role="radio"
          aria-checked={current === id}
          className={`theme-dot${current === id ? ' on' : ''}`}
          title={THEMES[id].label[lang]}
          aria-label={THEMES[id].label[lang]}
          onClick={() => setSetting('themeOverride', id)}
        >
          <span className="swatch" style={{ background: swatchBg(THEMES[id]) }} />
        </button>
      ))}
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
            <CodePlate code={room.code} small />
          </div>
        )}
        {isHost && (status === 'playing' || status === 'paused') && (
          <button
            className="btn"
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
          <div className="seg" role="group" aria-label={t('menu.sound')}>
            <button className={!settings.muted ? 'on' : ''} aria-pressed={!settings.muted} onClick={() => setSetting('muted', false)}>
              {t('menu.soundOn')}
            </button>
            <button className={settings.muted ? 'on' : ''} aria-pressed={settings.muted} onClick={() => setSetting('muted', true)}>
              {t('menu.soundOff')}
            </button>
          </div>
        </div>
        <div className="menu-row">
          <span>{t('menu.board')}</span>
          <div className="seg" role="group" aria-label={t('menu.board')}>
            <button className={settings.boardMode === '3d' ? 'on' : ''} aria-pressed={settings.boardMode === '3d'} onClick={() => setSetting('boardMode', '3d')}>
              {t('menu.board3d')}
            </button>
            <button className={settings.boardMode === '2d' ? 'on' : ''} aria-pressed={settings.boardMode === '2d'} onClick={() => setSetting('boardMode', '2d')}>
              {t('menu.board2d')}
            </button>
          </div>
        </div>
        <div className="field">
          <span>{t('home.theme')}</span>
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
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="paused-title">
      <div className="overlay-card lacquer pattern">
        <span className="emblem" aria-hidden>
          <Ico name="pause" size={30} />
        </span>
        <h2 id="paused-title">{t('paused.title')}</h2>
        <p>{t('paused.text', { code: room.code })}</p>
        <CodePlate code={room.code} />
        {isHost ? (
          <button className="btn primary big" onClick={() => send({ t: 'unpause' })}>
            <Ico name="play" /> {t('menu.resume')}
          </button>
        ) : (
          <p className="muted">
            <span className="spinner" aria-hidden /> {t('paused.waitHost')}
          </p>
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
  const youWon = view.winner !== null && view.winner === view.you;
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="fin-title">
      <div className="overlay-card lacquer finale">
        <div className="winner-banner" style={{ ['--pc' as string]: winner?.color ?? 'var(--gold)' }} aria-hidden>
          <span className="winner-rod" />
          <span className="winner-cloth">
            <span className="emblem">
              <Ico name="crown" size={32} />
            </span>
          </span>
        </div>
        <h2 id="fin-title">{youWon ? t('fin.youWon') : t('fin.title', { name: winner?.name ?? '?' })}</h2>
        <div className="rule small">
          <Star8 size={12} />
          <span>{t('fin.scores')}</span>
          <Star8 size={12} />
        </div>
        <ol className="scores">
          {sorted.map((p, i) => (
            <li key={p.seat} className={p.seat === view.winner ? 'win' : ''} style={{ ['--pc' as string]: p.color }}>
              <span className="rank">{i + 1}</span>
              <span className="nm">{p.name}</span>
              <span className="medal">{p.totalPoints ?? p.publicPoints}</span>
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
