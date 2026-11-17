import type { PlayerView, RoomInfo } from '@kervan/shared';
import { useNames, useT } from '../hooks';
import { Ico } from '../ui/Icons';

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
        return (
          <div
            key={p.seat}
            role="listitem"
            className={`pl${turn ? ' turn' : ''}${me ? ' me' : ''}${connected ? '' : ' offline'}`}
            style={{ ['--pc' as string]: p.color }}
          >
            <div className="pl-top">
              <span className="pl-dot" title={connected ? '' : t('pl.offline')} />
              <span className="pl-name">{p.name}</span>
              {me && <span className="pl-you">{t('common.you')}</span>}
              <span className="pl-pts" title={t('pl.points')}>
                <Ico name="star" size={13} />
                {points}
                {me && p.totalPoints !== null && p.totalPoints !== p.publicPoints && <small>({p.publicPoints})</small>}
              </span>
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
              <span title={t('pl.raiders', { card: names.card('raider') })}>
                <Ico name="swords" size={13} />
                {p.raidersPlayed}
              </span>
              {view.longestRoute.owner === p.seat && (
                <span className="pl-bonus" title={t('bonus.longestRoute')}>
                  <Ico name="route" size={13} />
                  +2
                </span>
              )}
              {view.strongestGuard.owner === p.seat && (
                <span className="pl-bonus" title={t('bonus.strongestGuard')}>
                  <Ico name="shield" size={13} />
                  +2
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
