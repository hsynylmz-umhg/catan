import { useEffect, useId, useRef, type ReactNode } from 'react';
import { RESOURCES, bagTotal, type Resource, type ResourceBag } from '@kervan/shared';
import { useStore } from '../store';
import { useLang, useNames, useT } from '../hooks';
import { errorText, translate } from '../i18n';
import { Ico, ResIcon, Star8 } from './Icons';

/** Modal lacquer sheet: slides up from the bottom on phones, centred on wide screens. */
export function Sheet({
  title,
  onClose,
  children,
  wide,
}: {
  title: ReactNode;
  onClose?: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const t = useT();
  const titleId = useId();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Move focus into the sheet so keyboard users land in it; restore it on close.
    const prev = document.activeElement as HTMLElement | null;
    box.current?.focus({ preventScroll: true });
    return () => prev?.focus?.({ preventScroll: true });
  }, []);
  useEffect(() => {
    if (!onClose) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="sheet-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div ref={box} tabIndex={-1} className={`sheet${wide ? ' sheet-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="strip">
          <div className="sheet-grip" aria-hidden />
          <div className="sheet-head">
            <h2 id={titleId}>
              <Star8 size={16} />
              {title}
            </h2>
            {onClose && (
              <button className="icon-btn" onClick={onClose} aria-label={t('common.close')}>
                <Ico name="close" />
              </button>
            )}
          </div>
        </header>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

/** +/- counters for the five resources. `max(r)` limits each row, `total` caps the sum. */
export function ResourcePicker({
  value,
  onChange,
  max,
  total,
}: {
  value: ResourceBag;
  onChange: (bag: ResourceBag) => void;
  max?: (r: Resource) => number;
  total?: number;
}) {
  const names = useNames();
  const sum = bagTotal(value);
  return (
    <div className="picker">
      {RESOURCES.map((r) => {
        const cap = max ? max(r) : 99;
        const canAdd = value[r] < cap && (total === undefined || sum < total);
        return (
          <div key={r} className={`picker-row${value[r] > 0 ? ' on' : ''}`}>
            <ResIcon res={r} size={34} />
            <span className="picker-name">
              {names.res(r)}
              {max && <small> / {cap}</small>}
            </span>
            <button className="step-btn" disabled={value[r] <= 0} onClick={() => onChange({ ...value, [r]: value[r] - 1 })} aria-label={`${names.res(r)} −1`}>
              −
            </button>
            <b className="picker-n">{value[r]}</b>
            <button className="step-btn" disabled={!canAdd} onClick={() => onChange({ ...value, [r]: value[r] + 1 })} aria-label={`${names.res(r)} +1`}>
              +
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const drop = useStore((s) => s.dropToast);
  const lang = useLang();
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`} onClick={() => drop(t.id)}>
          {t.kind === 'error' ? errorText(lang, t.code ?? 'unknown') : t.key ? translate(lang, t.key, t.vars) : ''}
        </div>
      ))}
    </div>
  );
}

export function ReconnectBanner() {
  const conn = useStore((s) => s.conn);
  const room = useStore((s) => s.room);
  const t = useT();
  if (!room || conn === 'open' || conn === 'idle') return null;
  return (
    <div className="reconnect" role="status">
      <span className="spinner" aria-hidden /> {t('conn.reconnecting')}
    </div>
  );
}

/** Room code as a gold-leaf plate, one cell per character so it is easy to read aloud. */
export function CodePlate({ code, small }: { code: string; small?: boolean }) {
  return (
    <div className={`plate${small ? ' small' : ''}`} role="img" aria-label={code.split('').join(' ')}>
      {code.split('').map((ch, i) => (
        <span key={i}>{ch}</span>
      ))}
    </div>
  );
}
