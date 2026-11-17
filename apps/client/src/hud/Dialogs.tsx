import { useState } from 'react';
import {
  HAND_LIMIT,
  RESOURCES,
  bagTotal,
  emptyBag,
  type DecreeCard,
  type PlayerView,
  type PublicPlayer,
  type Resource,
  type ResourceBag,
} from '@kervan/shared';
import { useStore, type BuildMode } from '../store';
import { useNames, useT, useThemeDef } from '../hooks';
import type { Key } from '../i18n';
import * as eng from '../engineSafe';
import { CostView, Ico, ResIcon, type IcoName } from '../ui/Icons';
import { ResourcePicker, Sheet } from '../ui/common';
import { PieceIcon } from '../ui/Pieces';

const CARD_ICON: Record<DecreeCard, IcoName> = { raider: 'swords', caravan: 'route', bounty: 'hand', bargain: 'bank', glory: 'crown' };

interface Props {
  view: PlayerView;
  me: PublicPlayer;
  onClose: () => void;
}

const toPair = (bag: ResourceBag): [Resource, Resource] => {
  const list: Resource[] = [];
  for (const r of RESOURCES) for (let i = 0; i < bag[r]; i++) list.push(r);
  return [list[0], list[1]];
};

export function BuildDialog({ view, me, onClose }: Props) {
  const t = useT();
  const names = useNames();
  const setMode = useStore((s) => s.setMode);
  const theme = useThemeDef();
  const upgrades = eng.upgradeVertices(view, me.seat).length;
  const rows: { kind: BuildMode; spots: number; free?: boolean; points: number }[] = [
    { kind: 'road', spots: eng.roadEdges(view, me.seat).length, free: view.freeRoads > 0, points: 0 },
    { kind: 'outpost', spots: eng.outpostVertices(view, me.seat).length, points: 1 },
    { kind: 'keep', spots: upgrades, points: 2 },
    { kind: 'market', spots: upgrades, points: 1 },
  ];
  return (
    <Sheet title={t('build.title')} onClose={onClose}>
      <div className="list">
        {rows.map((row) => {
          const left = me.piecesLeft[row.kind];
          const afford = row.free || eng.canAfford(view, me.seat, row.kind);
          const reason = left <= 0 ? t('build.noPieces') : !afford ? t('build.cantAfford') : row.spots === 0 ? t('build.noSpot') : null;
          const isUpgrade = row.kind === 'keep' || row.kind === 'market';
          return (
            <div key={row.kind} className={`list-row${reason ? ' dim' : ''}`}>
              <span className="piece-ico">
                <PieceIcon kind={row.kind} color={me.color} gold={theme.ui.gold} />
              </span>
              <div className="list-main">
                <b>{names.piece(row.kind)}</b>
                <small>
                  {isUpgrade && <span>{t('build.upgradeOf', { outpost: names.piece('outpost') })}</span>}
                  {row.points > 0 && <span>{t('build.points', { n: row.points })}</span>}
                  <span>{t('build.left', { n: left })}</span>
                </small>
                <div className="list-cost">{row.free ? <span className="chip">{t('build.free')}</span> : <CostView item={row.kind} />}</div>
                {reason && <small className="warn">{reason}</small>}
              </div>
              <button
                className="btn primary"
                disabled={!!reason}
                onClick={() => {
                  setMode(row.kind);
                  onClose();
                }}
              >
                {isUpgrade ? t('build.upgrade') : t('build.place')}
              </button>
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}

export function CardsDialog({ view, me, onClose, canAct }: Props & { canAct: boolean }) {
  const t = useT();
  const names = useNames();
  const act = useStore((s) => s.act);
  const [bounty, setBounty] = useState<ResourceBag | null>(null);
  const myTurn = canAct && view.current === me.seat && view.phase === 'main';
  const canPlayNow = myTurn && (view.step === 'roll' || view.step === 'actions') && !me.playedCardThisTurn;
  const canBuy = myTurn && view.step === 'actions' && view.deckCount > 0 && eng.canAfford(view, me.seat, 'card');
  const counts = new Map<DecreeCard, number>();
  for (const c of me.cards ?? []) counts.set(c, (counts.get(c) ?? 0) + 1);
  const fresh = new Map<DecreeCard, number>();
  for (const c of me.newCards ?? []) fresh.set(c, (fresh.get(c) ?? 0) + 1);

  const play = (card: DecreeCard) => {
    if (card === 'bounty') return setBounty(emptyBag());
    if (card === 'glory') return;
    act({ type: 'playCard', card });
    onClose();
  };

  if (bounty) {
    return (
      <Sheet title={`${names.card('bounty')} — ${t('cards.pick2')}`} onClose={() => setBounty(null)}>
        <ResourcePicker value={bounty} onChange={setBounty} total={2} />
        <div className="sheet-foot">
          <span className="muted">{t('pick.count', { n: bagTotal(bounty), total: 2 })}</span>
          <button
            className="btn primary"
            disabled={bagTotal(bounty) !== 2}
            onClick={() => {
              act({ type: 'playCard', card: 'bounty', resources: toPair(bounty) });
              onClose();
            }}
          >
            {t('cards.play')}
          </button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title={t('cards.title', { decree: names.decree })} onClose={onClose}>
      <div className="list-row buy-row">
        <span className="piece-ico">
          <Ico name="scroll" size={22} />
        </span>
        <div className="list-main">
          <b>{t('cards.buy', { decree: names.decree })}</b>
          <div className="list-cost">
            <CostView item="card" />
          </div>
          <small className={view.deckCount === 0 ? 'warn' : ''}>
            <span>{view.deckCount > 0 ? t('cards.deck', { n: view.deckCount }) : t('cards.deckEmpty')}</span>
            {myTurn && view.step === 'roll' && <span>{t('cards.afterRoll')}</span>}
          </small>
        </div>
        <button className="btn primary" disabled={!canBuy} onClick={() => act({ type: 'buyCard' })}>
          {t('cards.buyBtn')}
        </button>
      </div>
      {me.playedCardThisTurn && myTurn && <p className="muted">{t('cards.played')}</p>}
      {counts.size + fresh.size === 0 && <p className="muted">{t('cards.none')}</p>}
      <div className="cards">
        {[...counts.entries()].map(([card, n]) => (
          <div key={card} className={`decree-c decree-${card}`}>
            <div className="decree-head">
              <span className="seal">
                <Ico name={CARD_ICON[card]} size={16} />
              </span>
              <b>{names.card(card)}</b>
              {n > 1 && <span className="count">×{n}</span>}
            </div>
            <p>{t(`card.${card}.d` as Key, { bandit: names.bandit })}</p>
            {card !== 'glory' && (
              <button className="btn small primary" disabled={!canPlayNow} onClick={() => play(card)}>
                {t('cards.play')}
              </button>
            )}
          </div>
        ))}
        {[...fresh.entries()].map(([card, n]) => (
          <div key={`n-${card}`} className={`decree-c decree-${card} fresh`}>
            <div className="decree-head">
              <span className="seal">
                <Ico name={CARD_ICON[card]} size={16} />
              </span>
              <b>{names.card(card)}</b>
              {n > 1 && <span className="count">×{n}</span>}
            </div>
            <p>{t(`card.${card}.d` as Key, { bandit: names.bandit })}</p>
            <small className="muted">{t('cards.new')}</small>
          </div>
        ))}
      </div>
    </Sheet>
  );
}

export function BankDialog({ view, me, onClose }: Props) {
  const t = useT();
  const names = useNames();
  const act = useStore((s) => s.act);
  const [give, setGive] = useState<Resource | null>(null);
  const [want, setWant] = useState<Resource | null>(null);
  const bag = me.resources ?? emptyBag();
  const rate = (r: Resource) => eng.bankRate(view, me.seat, r);
  const ok = give !== null && want !== null && give !== want && bag[give] >= rate(give);
  return (
    <Sheet title={t('bank.title')} onClose={onClose}>
      <p className="muted">{t('bank.hint')}</p>
      <h3>{t('bank.give')}</h3>
      <div className="res-grid">
        {RESOURCES.map((r) => {
          const rt = rate(r);
          return (
            <button key={r} className={`res-opt${give === r ? ' on' : ''}`} disabled={bag[r] < rt} onClick={() => { setGive(r); if (want === r) setWant(null); }}>
              <ResIcon res={r} size={34} />
              <b>{rt}:1</b>
              <small>{names.res(r)}</small>
              <small>{t('bank.have', { n: bag[r] })}</small>
            </button>
          );
        })}
      </div>
      <h3>{t('bank.want')}</h3>
      <div className="res-grid">
        {RESOURCES.map((r) => (
          <button key={r} className={`res-opt${want === r ? ' on' : ''}`} disabled={r === give} onClick={() => setWant(r)}>
            <ResIcon res={r} size={34} />
            <b>+1</b>
            <small>{names.res(r)}</small>
          </button>
        ))}
      </div>
      <div className="sheet-foot">
        <span className="muted">
          {give && want ? t('bank.summary', { n: rate(give), give: names.res(give), want: names.res(want) }) : ''}
        </span>
        <button className="btn primary" disabled={!ok} onClick={() => ok && act({ type: 'bankTrade', give: give!, want: want! })}>
          {t('bank.do')}
        </button>
      </div>
    </Sheet>
  );
}

export function TradeDialog({ me, onClose }: Props) {
  const t = useT();
  const act = useStore((s) => s.act);
  const [give, setGive] = useState<ResourceBag>(emptyBag());
  const [want, setWant] = useState<ResourceBag>(emptyBag());
  const bag = me.resources ?? emptyBag();
  const overlap = RESOURCES.some((r) => give[r] > 0 && want[r] > 0);
  const ok = bagTotal(give) > 0 && bagTotal(want) > 0 && !overlap;
  return (
    <Sheet title={t('trade.title')} onClose={onClose} wide>
      <div className="two-col">
        <div>
          <h3>{t('trade.give')}</h3>
          <ResourcePicker value={give} onChange={setGive} max={(r) => bag[r]} />
        </div>
        <div>
          <h3>{t('trade.want')}</h3>
          <ResourcePicker value={want} onChange={setWant} total={12} />
        </div>
      </div>
      <div className="sheet-foot">
        <span className={overlap ? 'warn' : 'muted'}>{!ok ? t('trade.invalid') : ''}</span>
        <button
          className="btn primary"
          disabled={!ok}
          onClick={() => {
            act({ type: 'offerTrade', give, want });
            onClose();
          }}
        >
          {t('trade.offer')}
        </button>
      </div>
    </Sheet>
  );
}

export function DiscardDialog({ me, onClose }: Props) {
  const t = useT();
  const act = useStore((s) => s.act);
  const [pick, setPick] = useState<ResourceBag>(emptyBag());
  const bag = me.resources ?? emptyBag();
  const need = Math.max(0, me.resourceCount - HAND_LIMIT);
  return (
    <Sheet title={t('discard.title')} onClose={onClose}>
      <p>{t('discard.text', { n: need })}</p>
      <ResourcePicker value={pick} onChange={setPick} max={(r) => bag[r]} total={need} />
      <div className="sheet-foot">
        <span className="muted">{t('pick.count', { n: bagTotal(pick), total: need })}</span>
        <button
          className="btn primary"
          disabled={bagTotal(pick) !== need}
          onClick={() => {
            act({ type: 'endTurn', discard: pick });
            onClose();
          }}
        >
          {t('discard.do')}
        </button>
      </div>
    </Sheet>
  );
}

export function SevenDialog() {
  const t = useT();
  const names = useNames();
  const act = useStore((s) => s.act);
  const [pick, setPick] = useState<ResourceBag | null>(null);
  if (pick) {
    return (
      <Sheet title={t('seven.tribute')} onClose={() => setPick(null)}>
        <ResourcePicker value={pick} onChange={setPick} total={2} />
        <div className="sheet-foot">
          <span className="muted">{t('pick.count', { n: bagTotal(pick), total: 2 })}</span>
          <button
            className="btn primary"
            disabled={bagTotal(pick) !== 2}
            onClick={() => act({ type: 'sevenChoice', choice: 'tribute', resources: toPair(pick) })}
          >
            {t('seven.take')}
          </button>
        </div>
      </Sheet>
    );
  }
  return (
    <Sheet title={t('seven.title')}>
      <div className="choice">
        <button className="btn big primary" onClick={() => setPick(emptyBag())}>
          <Ico name="hand" />
          {t('seven.tribute')}
        </button>
        <button className="btn big" onClick={() => act({ type: 'sevenChoice', choice: 'bandit' })}>
          <Ico name="swords" />
          {t('seven.bandit', { bandit: names.bandit })}
        </button>
      </div>
    </Sheet>
  );
}

export function StealDialog({ view }: { view: PlayerView }) {
  const t = useT();
  const act = useStore((s) => s.act);
  return (
    <Sheet title={t('steal.title')}>
      <div className="choice">
        {view.stealCandidates.map((seat) => {
          const p = view.players.find((x) => x.seat === seat);
          if (!p) return null;
          return (
            <button key={seat} className="btn big victim" style={{ ['--pc' as string]: p.color }} onClick={() => act({ type: 'steal', victim: seat })}>
              <i className="pl-dot big" />
              <b>{p.name}</b>
              <small>{t('steal.cards', { n: p.resourceCount })}</small>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
