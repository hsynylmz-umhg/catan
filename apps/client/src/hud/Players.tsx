import type { PlayerView, RoomInfo } from '@kervan/shared';
import { useNames, useT } from '../hooks';
import { Ico } from '../ui/Icons';

/** One heraldic banner per player: colour pennant, name, points medallion, counts. */
export function PlayersStrip({ view, room }: { view: PlayerView; room: RoomInfo | null }) {
  const t = useT();
  const names = useNames();
  return (
    <div className="players" role="list">
      {view.players.map((p) => {
        const me = p.seat === view.you;
        const connected = room?.members.find((m) => m.seat === p.seat)?.connected ?? true;
        const turn = view.phase !== 'finished' && view.current === p.seat;
        const points = p.totalPoints ?? p.publicPoints;
        const hidden = me && p.totalPoints !== null && p.totalPoints !== p.publicPoints;
        return (
          <div
            key={p.seat}
            role="listitem"
            aria-current={turn ? 'true' : undefined}
            className={`pl${turn ? ' turn' : ''}${me ? ' me' : ''}${connected ? '' : ' offline'}`}
            style={{ ['--pc' as string]: p.color }}
          >
            <span className="pl-flag" aria-hidden />
            <div className="pl-body">
              <div className="pl-top">
                <span className="pl-name">{p.name}</span>
                {me && <span className="tag">{t('common.you')}</span>}
                {!connected && <span className="sr-only">{t('pl.offline')}</span>}
              </div>
              <div className="pl-stats">
                <span title={t('pl.resources')}>
                  <Ico name="hand" size={13} />
                  {p.resourceCount}
                </span>
                <span title={t('pl.cards')}>
                  <Ico name="scroll" size={13} />
                  {p.cardCount}
                </span>
                {p.raidersPlayed > 0 && (
                  <span title={t('pl.raiders', { card: names.card('raider') })}>
                    <Ico name="swords" size={13} />
                    {p.raidersPlayed}
                  </span>
                )}
                {view.longestRoute.owner === p.seat && (
                  <span className="pl-bonus" title={t('bonus.longestRoute')}>
                    <Ico name="route" size={13} />+2
                  </span>
                )}
                {view.strongestGuard.owner === p.seat && (
                  <span className="pl-bonus" title={t('bonus.strongestGuard')}>
                    <Ico name="shield" size={13} />+2
                  </span>
                )}
              </div>
            </div>
            <span className="medal" title={hidden ? t('pl.pointsHidden', { n: p.publicPoints }) : t('pl.points')}>
              {points}
            </span>
          </div>
        );
      })}
    </div>
  );
}
