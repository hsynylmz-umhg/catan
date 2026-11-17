import { HAND_LIMIT, RESOURCES, type PlayerView, type PublicPlayer } from '@kervan/shared';
import { useStore } from '../store';
import { useNames, useT } from '../hooks';
import { BagView, Ico, ResIcon } from '../ui/Icons';

export type DialogName = 'build' | 'cards' | 'bank' | 'trade' | 'discard' | 'menu' | null;

const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function Die({ n }: { n: number }) {
  return (
    <span className="die" aria-label={String(n)}>
      {Array.from({ length: 9 }, (_, i) => (
        <i key={i} className={PIPS[n]?.includes(i) ? 'on' : ''} />
      ))}
    </span>
  );
}

export function Dice({ dice }: { dice: [number, number] | null }) {
  const tick = useStore((s) => s.diceTick);
  if (!dice) return <span className="dice dice-empty" />;
  return (
    <span className="dice" key={tick}>
      <Die n={dice[0]} />
      <Die n={dice[1]} />
      <b className={dice[0] + dice[1] === 7 ? 'seven' : ''}>{dice[0] + dice[1]}</b>
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
          <BagView bag={offer.give} /> <span className="arrow">→</span> <BagView bag={offer.want} />
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

function Hand({ me, open }: { me: PublicPlayer; open: (d: DialogName) => void }) {
  const names = useNames();
  const bag = me.resources;
  const over = me.resourceCount > HAND_LIMIT;
  return (
    <div className="hand">
      {RESOURCES.map((r) => (
        <div key={r} className={`hand-chip${bag && bag[r] > 0 ? '' : ' zero'}`}>
          <ResIcon res={r} size={30} />
          <b>{bag ? bag[r] : 0}</b>
          <small>{names.res(r)}</small>
        </div>
      ))}
      <button className={`hand-chip cards-chip${over ? ' over' : ''}`} onClick={() => open('cards')}>
        <span className="card-glyph">
          <Ico name="scroll" size={20} />
        </span>
        <b>{me.cardCount}</b>
        <small>{names.decree}</small>
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
    <section className={`dock${status.mine ? ' mine' : ''}`}>
      <div className="band" />
      <div className="status">
        {view.phase !== 'finished' &&
          (status.mine ? (
            <span className="turn-badge mine">{t('game.yourTurn')}</span>
          ) : (
            <span className="turn-badge" style={{ ['--pc' as string]: cur?.color ?? 'var(--muted)' }}>
              <i className="pl-dot" />
              {cur?.name}
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
            {t('act.roll')}
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
              {t('act.build')}
            </button>
            <button className="btn" onClick={() => open('bank')}>
              {t('act.bank')}
            </button>
            <button className="btn" onClick={() => open('trade')}>
              {t('act.trade')}
            </button>
            <button className="btn primary" onClick={endTurn}>
              {t('act.end')}
            </button>
          </>
        )}
        {!myRoll && !myActions && (
          <span className="actions-idle">
            {view.phase === 'setup' ? t('game.setup') : t('game.turn', { n: view.turn })}
            {' · '}
            {t('game.target', { n: view.config.targetPoints })}
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
