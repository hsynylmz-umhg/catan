import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { useStore } from '../store';
import { useT, useThemeDef } from '../hooks';
import * as eng from '../engineSafe';
import Board2D from '../board/Board2D';
import { NO_HIGHLIGHTS, webglAvailable, type Highlights, type PickKind } from '../board/types';
import { PlayersStrip } from '../hud/Players';
import { Dock, type DialogName } from '../hud/Dock';
import { SidePanel } from '../hud/SidePanel';
import { BankDialog, BuildDialog, CardsDialog, DiscardDialog, SevenDialog, StealDialog, TradeDialog } from '../hud/Dialogs';
import { FinishedOverlay, MenuDialog, PausedOverlay } from '../hud/Menu';
import { Ico } from '../ui/Icons';

const Board3D = lazy(() => import('../board/Board3D'));

export function Game() {
  const t = useT();
  const theme = useThemeDef();
  const view = useStore((s) => s.view);
  const room = useStore((s) => s.room);
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  const act = useStore((s) => s.act);
  const lastBuilt = useStore((s) => s.lastBuilt);
  const boardMode = useStore((s) => s.settings.boardMode);
  const muted = useStore((s) => s.settings.muted);
  const setSetting = useStore((s) => s.setSetting);
  const pushToast = useStore((s) => s.pushToast);
  const setPanel = useStore((s) => s.setPanel);
  const unread = useStore((s) => s.unreadChat);
  const unreadLog = useStore((s) => s.unreadLog);

  const [dialog, setDialog] = useState<DialogName>(null);
  const [no3d, setNo3d] = useState(() => !webglAvailable());
  const [hideFinished, setHideFinished] = useState(false);

  const fail3d = useCallback(() => {
    setNo3d(true);
    pushToast({ kind: 'info', key: 'board.no3d' });
  }, [pushToast]);

  const me = view && view.you !== null ? view.players.find((p) => p.seat === view.you) ?? null : null;
  const paused = room?.status === 'paused';
  const finished = view?.phase === 'finished';
  const myTurn = !!view && !!me && view.current === me.seat && !finished && !paused;
  const isHost = !!room && !!me && room.hostSeat === me.seat;

  // Close action dialogs when the situation changes under them.
  const sig = view ? `${view.phase}|${view.current}|${view.step}` : '';
  useEffect(() => {
    setDialog((d) => (d === 'menu' || d === 'cards' ? d : null));
  }, [sig]);

  const highlights: Highlights = useMemo(() => {
    if (!view || !me || !myTurn) return NO_HIGHLIGHTS;
    if (view.phase === 'setup') {
      return view.setup?.expecting === 'road'
        ? { ...NO_HIGHLIGHTS, edges: eng.roadEdges(view, me.seat) }
        : { ...NO_HIGHLIGHTS, vertices: eng.outpostVertices(view, me.seat) };
    }
    if (view.step === 'moveBandit') return { ...NO_HIGHLIGHTS, hexes: eng.banditHexes(view) };
    if (view.step !== 'actions' || !mode) return NO_HIGHLIGHTS;
    if (mode === 'road') return { ...NO_HIGHLIGHTS, edges: eng.roadEdges(view, me.seat) };
    if (mode === 'outpost') return { ...NO_HIGHLIGHTS, vertices: eng.outpostVertices(view, me.seat) };
    return { ...NO_HIGHLIGHTS, vertices: eng.upgradeVertices(view, me.seat) };
  }, [view, me, myTurn, mode]);

  const onPick = useCallback(
    (kind: PickKind, id: number) => {
      if (!view || !myTurn) return;
      if (kind === 'hex') return act({ type: 'moveBandit', hex: id });
      if (kind === 'edge') {
        act({ type: 'buildRoad', edge: id });
        if (view.phase === 'main' && view.freeRoads <= 1) setMode(null);
        return;
      }
      if (view.phase === 'setup' || mode === 'outpost') act({ type: 'buildOutpost', vertex: id });
      else if (mode === 'keep' || mode === 'market') act({ type: 'upgrade', vertex: id, to: mode });
      if (view.phase === 'main') setMode(null);
    },
    [view, myTurn, mode, act, setMode],
  );

  if (!view) {
    return (
      <div className="center-screen">
        <span className="spinner" /> {t('common.loading')}
      </div>
    );
  }

  const use3d = boardMode === '3d' && !no3d;
  const boardProps = { view, theme, highlights, onPick, lastBuilt };

  return (
    <div className="game">
      <header className="top">
        <PlayersStrip view={view} room={room} />
      </header>

      <main className="board-wrap">
        {use3d ? (
          <Suspense fallback={<div className="board-loading"><span className="spinner" /></div>}>
            <Board3D {...boardProps} onFail={fail3d} />
          </Suspense>
        ) : (
          <Board2D {...boardProps} />
        )}
        <div className="board-tools">
          <button className="tool" onClick={() => setDialog('menu')} aria-label={t('menu.title')}>
            <Ico name="menu" />
          </button>
          <button
            className="tool"
            disabled={no3d}
            onClick={() => setSetting('boardMode', boardMode === '3d' ? '2d' : '3d')}
            aria-label={use3d ? t('menu.board2d') : t('menu.board3d')}
          >
            <Ico name={use3d ? 'flat' : 'cube'} />
            <small>{use3d ? '2D' : '3D'}</small>
          </button>
          <button className="tool" onClick={() => setSetting('muted', !muted)} aria-label={t('menu.sound')}>
            <Ico name={muted ? 'soundOff' : 'soundOn'} />
          </button>
          <button className="tool only-narrow" onClick={() => setPanel(true)} aria-label={t('panel.chat')}>
            <Ico name="chat" />
            {unread > 0 ? <span className="badge-n">{unread}</span> : unreadLog > 0 ? <span className="dot" /> : null}
          </button>
        </div>
        {finished && hideFinished && (
          <button className="btn primary show-scores" onClick={() => setHideFinished(false)}>
            {t('fin.showScores')}
          </button>
        )}
      </main>

      <Dock view={view} me={me} paused={!!paused} open={setDialog} />
      <SidePanel />

      {me && myTurn && view.phase === 'main' && view.step === 'sevenChoice' && <SevenDialog />}
      {me && myTurn && view.phase === 'main' && view.step === 'steal' && <StealDialog view={view} />}
      {me && dialog === 'build' && myTurn && <BuildDialog view={view} me={me} onClose={() => setDialog(null)} />}
      {me && dialog === 'cards' && <CardsDialog view={view} me={me} canAct={myTurn} onClose={() => setDialog(null)} />}
      {me && dialog === 'bank' && myTurn && <BankDialog view={view} me={me} onClose={() => setDialog(null)} />}
      {me && dialog === 'trade' && myTurn && <TradeDialog view={view} me={me} onClose={() => setDialog(null)} />}
      {me && dialog === 'discard' && myTurn && <DiscardDialog view={view} me={me} onClose={() => setDialog(null)} />}
      {dialog === 'menu' && <MenuDialog view={view} room={room} isHost={isHost} onClose={() => setDialog(null)} />}

      {paused && room && !finished && <PausedOverlay room={room} isHost={isHost} />}
      {finished && !hideFinished && <FinishedOverlay view={view} onHide={() => setHideFinished(true)} />}
    </div>
  );
}
