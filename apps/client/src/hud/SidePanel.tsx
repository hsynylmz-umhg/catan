import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { useNames, useT } from '../hooks';
import { Ico } from '../ui/Icons';
import { eventLine } from './logText';

/** Game log + chat. Docked on wide screens, a bottom sheet on phones. */
export function SidePanel() {
  const t = useT();
  const names = useNames();
  const { panelOpen, panelTab, setPanel, unreadChat, unreadLog, log, chat, view, send, seat } = useStore();
  const [text, setText] = useState('');
  const scroller = useRef<HTMLDivElement>(null);

  const count = panelTab === 'log' ? log.length : chat.length;
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [count, panelTab, panelOpen]);

  const submit = () => {
    const msg = text.trim().slice(0, 300);
    if (!msg) return;
    send({ t: 'chat', text: msg });
    setText('');
  };
  const colorOf = (s: number | null) => (s === null ? 'transparent' : view?.players.find((p) => p.seat === s)?.color ?? 'var(--muted)');

  return (
    <>
      {panelOpen && <div className="side-backdrop" onClick={() => setPanel(false)} />}
      <aside className={`side${panelOpen ? ' open' : ''}`} aria-label={t('panel.title')}>
        <div className="tabs strip">
          <button aria-pressed={panelTab === 'log'} className={panelTab === 'log' ? 'on' : ''} onClick={() => setPanel(panelOpen, 'log')}>
            {t('panel.log')}
            {unreadLog > 0 && panelTab !== 'log' && <span className="dot" />}
          </button>
          <button aria-pressed={panelTab === 'chat'} className={panelTab === 'chat' ? 'on' : ''} onClick={() => setPanel(panelOpen, 'chat')}>
            {t('panel.chat')}
            {unreadChat > 0 && <span className="badge-n">{unreadChat}</span>}
          </button>
          <button className="icon-btn side-close" onClick={() => setPanel(false)} aria-label={t('common.close')}>
            <Ico name="close" />
          </button>
        </div>
        <div className="side-scroll" ref={scroller}>
          {panelTab === 'log' ? (
            log.length === 0 ? (
              <p className="muted pad">{t('log.empty')}</p>
            ) : (
              log.map((entry, i) => {
                const line = eventLine(entry.event, view, t, names);
                if (!line.text) return null;
                return (
                  <div key={i} className={`log-line${line.strong ? ' strong' : ''}`}>
                    <span className="log-dot" style={{ background: colorOf(line.seat) }} />
                    <span>{line.text}</span>
                  </div>
                );
              })
            )
          ) : chat.length === 0 ? (
            <p className="muted pad">{t('chat.empty')}</p>
          ) : (
            chat.map((m, i) => (
              <div key={i} className={`chat-line${m.seat === seat ? ' mine' : ''}`}>
                <b style={{ color: colorOf(m.seat) }}>{m.name}</b>
                <span>{m.text}</span>
              </div>
            ))
          )}
        </div>
        {panelTab === 'chat' && (
          <form
            className="chat-form"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <input value={text} maxLength={300} placeholder={t('chat.ph')} onChange={(e) => setText(e.target.value)} enterKeyHint="send" />
            <button className="btn primary" type="submit" disabled={!text.trim()}>
              {t('chat.send')}
            </button>
          </form>
        )}
      </aside>
    </>
  );
}
