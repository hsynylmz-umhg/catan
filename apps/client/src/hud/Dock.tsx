import { useEffect, useRef, useState } from 'react';
import { HAND_LIMIT, RESOURCES, type PlayerView, type PublicPlayer, type Resource } from '@kervan/shared';
import { useStore } from '../store';
import { useNames, useT } from '../hooks';
import { BagView, Ico, ResEmblem, Star8 } from '../ui/Icons';

export type DialogName = 'build' | 'cards' | 'bank' | 'trade' | 'discard' | 'menu' | null;

const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

/** Cube rotation that brings face n to the front (faces are laid out in .face.f1..f6). */
const FACE_TURN: Record<number, [number, number]> = { 1: [0, 0], 2: [0, -90], 3: [-90, 0], 4: [90, 0], 5: [0, 90], 6: [0, 180] };

function Die({ n }: { n: number }) {
  const [fx, fy] = FACE_TURN[n] ?? [0, 0];
  return (
    <span className="die3d" style={{ ['--fx' as string]: `${fx}deg`, ['--fy' as string]: `${fy}deg` }} aria-hidden>
      {[1, 2, 3, 4, 5, 6].map((f) => (
        <span key={f} className={`face f${f}`}>
          {Array.from({ length: 9 }, (_, i) => (
            <i key={i} className={PIPS[f].includes(i) ? 'on' : ''} />
          ))}
        </span>
      ))}
    </span>
  );
}

export function Dice({ dice }: { dice: [number, number] | null }) {
  const t = useT();
  const tick = useStore((s) => s.diceTick);
  if (!dice) return <span className="dice dice-empty" />;
  const sum = dice[0] + dice[1];
  return (
    <span className="dice" key={tick} role="img" aria-label={t('dice.aria', { a: dice[0], b: dice[1], sum })}>
      <Die n={dice[0]} />
      <Die n={dice[1]} />
      <b className={`dice-sum${sum === 7 ? ' seven' : ''}`} aria-hidden>
        {sum}
      </b>
    </span>
  );
}

function useStatus(view: PlayerView, me: PublicPlayer | null): { mine: boolean; text: string } {
  const t = useT();
  const names = useNames();
  const mode = useStore((s) => s.mode);
  const cur = view.players.find((p) => p.seat === view.current);
  const name = cur?.name ?? '?';
  const mine = !!me && view.current === me.seat && view.phase !== 'finished';
  if (view.phase === 'finished') return { mine: false, text: '' };
  if (view.phase === 'setup') {
    if (!mine) return { mine, text: t('wait.setup', { name }) };
    return {
      mine,
      text:
        view.setup?.expecting === 'road'
          ? t('exp.setupRoad', { piece: names.piece('road'), outpost: names.piece('outpost') })
          : t('exp.setupOutpost', { piece: names.piece('outpost') }),
    };
  }
  if (!mine) {
    const key = ({ roll: 'wait.roll', sevenChoice: 'wait.seven', moveBandit: 'wait.moveBandit', steal: 'wait.steal', actions: 'wait.actions' } as const)[view.step];
    return { mine, text: t(key, { name, bandit: names.bandit }) };
  }
  switch (view.step) {
    case 'roll':
      return { mine, text: t('exp.roll') };
    case 'sevenChoice':
      return { mine, text: t('exp.seven', { bandit: names.bandit }) };
    case 'moveBandit':
      return { mine, text: t('exp.moveBandit', { bandit: names.bandit }) };
    case 'steal':
      return { mine, text: t('exp.steal') };
    default:
      if (mode === 'road') return { mine, text: t('exp.pickRoad', { piece: names.piece('road') }) };
      if (mode) return { mine, text: t('exp.pickVertex', { piece: names.piece(mode) }) };
      if (view.trade?.from === me?.seat) return { mine, text: t('exp.tradeOpen') };
      return { mine, text: t('exp.actions') };
  }
}

function TradePanel({ view, me }: { view: PlayerView; me: PublicPlayer }) {
  const t = useT();
  const act = useStore((s) => s.act);
  const offer = view.trade;
  if (!offer) return null;
  if (offer.from === me.seat) {
    return (
      <div className="trade-panel">
        <div className="trade-sum">
          <b>{t('trade.yourOffer')}</b>
          <BagView bag={offer.give} />
          <span className="swap-ico" role="img" aria-label={t('trade.for')}>
            <Ico name="trade" size={16} />
          </span>
          <BagView bag={offer.want} />
          <button className="btn small ghost" onClick={() => act({ type: 'cancelTrade' })}>
            {t('trade.cancel')}
          </button>
        </div>
        <div className="trade-resp">
          {view.players
            .filter((p) => p.seat !== me.seat)
            .map((p) => {
              const r = offer.responses[p.seat];
              return (
                <span key={p.seat} className={`resp resp-${r ?? 'wait'}`} style={{ ['--pc' as string]: p.color }}>
                  <i className="pl-dot" />
                  {p.name}
                  {r === 'accept' ? (
                    <button className="btn small primary" onClick={() => act({ type: 'confirmTrade', with: p.seat })}>
                      {t('trade.confirm')}
                    </button>
                  ) : (
                    <small>{r === 'decline' ? t('trade.declined') : t('trade.waiting')}</small>
                  )}
                </span>
              );
            })}
        </div>
      </div>
    );
  }
  const from = view.players.find((p) => p.seat === offer.from);
  const mine = offer.responses[me.seat];
  const can = !!me.resources && RESOURCES.every((r) => me.resources![r] >= offer.want[r]);
  return (
    <div className="trade-panel incoming">
      <div className="trade-sum">
        <b>{t('trade.offerFrom', { name: from?.name ?? '?' })}</b>
      </div>
      <div className="trade-sum">
        <span className="muted">{t('trade.youGet')}</span> <BagView bag={offer.give} />
        <span className="muted">{t('trade.youGive')}</span> <BagView bag={offer.want} />
      </div>
      <div className="trade-resp">
        {mine === 'accept' && <small>{t('trade.youAccepted')}</small>}
        {mine === 'decline' && <small>{t('trade.youDeclined')}</small>}
        {!can && mine !== 'decline' && <small className="warn">{t('trade.cant')}</small>}
        <span className="grow" />
        {mine !== 'decline' && (
          <button className="btn small ghost" onClick={() => act({ type: 'respondTrade', accept: false })}>
            {t('trade.decline')}
          </button>
        )}
        {mine !== 'accept' && (
          <button className="btn small primary" disabled={!can} onClick={() => act({ type: 'respondTrade', accept: true })}>
            {t('trade.accept')}
          </button>
        )}
      </div>
    </div>
  );
}

/** One illustrated resource card; glows briefly whenever its count goes up. */
function ResCard({ res, n, label }: { res: Resource; n: number; label: string }) {
  const prev = useRef(n);
  const [gain, setGain] = useState(0);
  useEffect(() => {
    if (n > prev.current) setGain((g) => g + 1);
    prev.current = n;
  }, [n]);
  return (
    <div className={`rcard${n > 0 ? '' : ' zero'}${gain ? ' bump' : ''}`} style={{ ['--rc' as string]: `var(--res-${res})` }} role="listitem" aria-label={`${label}: ${n}`}>
      {gain > 0 && <span key={gain} className="gain" aria-hidden />}
      <span className="rcard-count" aria-hidden key={`c${gain}`}>
        {n}
      </span>
      <ResEmblem res={res} />
      <span className="rcard-name" aria-hidden>
        {label}
      </span>
    </div>
  );
}

function Hand({ me, open }: { me: PublicPlayer; open: (d: DialogName) => void }) {
  const t = useT();
  const names = useNames();
  const bag = me.resources;
  const over = me.resourceCount > HAND_LIMIT;
  return (
    <div className="hand" role="list" aria-label={t('pl.resources')}>
      {RESOURCES.map((r) => (
        <ResCard key={r} res={r} n={bag ? bag[r] : 0} label={names.res(r)} />
      ))}
      <button
        className={`rcard decree${over ? ' over' : ''}`}
        onClick={() => open('cards')}
        aria-label={`${t('cards.title', { decree: names.decree })}: ${me.cardCount}`}
      >
        <span className="rcard-count" aria-hidden>
          {me.cardCount}
        </span>
        <span className="seal" aria-hidden>
          <Ico name="scroll" size={20} />
        </span>
        <span className="rcard-name" aria-hidden>
          {names.decree}
        </span>
      </button>
    </div>
  );
}

export function Dock({ view, me, paused, open }: { view: PlayerView; me: PublicPlayer | null; paused: boolean; open: (d: DialogName) => void }) {
  const t = useT();
  const names = useNames();
  const act = useStore((s) => s.act);
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  const status = useStatus(view, me);
  const cur = view.players.find((p) => p.seat === view.current);
  const myActions = status.mine && view.phase === 'main' && view.step === 'actions' && !paused;
  const myRoll = status.mine && view.phase === 'main' && view.step === 'roll' && !paused;

  const endTurn = () => {
    if (me && me.resourceCount > HAND_LIMIT) open('discard');
    else act({ type: 'endTurn' });
  };

  return (
    <section className={`dock${status.mine ? ' mine' : ''}`} aria-label={t('game.dock')}>
      <div className="status" aria-live="polite">
        {view.phase !== 'finished' &&
          (status.mine ? (
            <span className="turn-ribbon mine">
              <Star8 size={16} />
              {t('game.yourTurn')}
            </span>
          ) : (
            <span className="turn-ribbon" style={{ ['--pc' as string]: cur?.color ?? 'var(--muted)' }}>
              <i className="pl-dot" />
              <span>{cur?.name}</span>
            </span>
          ))}
        <span className="status-text">{status.text}</span>
        <Dice dice={view.dice} />
      </div>

      {me && view.trade && view.phase === 'main' && <TradePanel view={view} me={me} />}
      {me && <Hand me={me} open={open} />}

      <div className="actions">
        {myRoll && (
          <button className="btn primary big grow" onClick={() => act({ type: 'roll' })}>
            <Ico name="dice" size={22} /> {t('act.roll')}
          </button>
        )}
        {myActions && mode && (
          <button className="btn grow" onClick={() => setMode(null)}>
            {t('act.cancelPick')}
          </button>
        )}
        {myActions && !mode && (
          <>
            <button className="btn" onClick={() => open('build')}>
              <Ico name="build" /> {t('act.build')}
            </button>
            <button className="btn" onClick={() => open('bank')}>
              <Ico name="bank" /> {t('act.bank')}
            </button>
            <button className="btn" onClick={() => open('trade')}>
              <Ico name="trade" /> {t('act.trade')}
            </button>
            <button className="btn primary" onClick={endTurn}>
              <Ico name="end" /> {t('act.end')}
            </button>
          </>
        )}
        {!myRoll && !myActions && (
          <span className="actions-idle">
            <span>{view.phase === 'setup' ? t('game.setup') : t('game.turn', { n: view.turn })}</span>
            <Star8 size={10} />
            <span>{t('game.target', { n: view.config.targetPoints })}</span>
          </span>
        )}
        {status.mine && view.phase === 'main' && (view.freeRoads > 0 || view.bargainActive) && (
          <span className="chips">
            {view.freeRoads > 0 && <span className="chip">{t('exp.freeRoads', { piece: names.piece('road'), n: view.freeRoads })}</span>}
            {view.bargainActive && <span className="chip">{t('exp.bargain')}</span>}
          </span>
        )}
      </div>
    </section>
  );
}
