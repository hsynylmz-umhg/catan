import { useEffect, type ReactNode } from 'react';
import { RESOURCES, bagTotal, type Resource, type ResourceBag } from '@kervan/shared';
import { useStore } from '../store';
import { useLang, useNames, useT } from '../hooks';
import { errorText, translate } from '../i18n';
import { Ico, ResIcon } from './Icons';

/** Modal: bottom sheet on phones, centred card on wide screens. */
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
  useEffect(() => {
    if (!onClose) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="sheet-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`sheet${wide ? ' sheet-wide' : ''}`} role="dialog" aria-modal="true">
        <div className="band" />
        <header className="sheet-head">
          <h2>{title}</h2>
          {onClose && (
            <button className="icon-btn" onClick={onClose} aria-label="close">
              <Ico name="close" />
            </button>
          )}
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
            <ResIcon res={r} size={28} />
            <span className="picker-name">
              {names.res(r)}
              {max && <small> / {cap}</small>}
            </span>
            <button className="step-btn" disabled={value[r] <= 0} onClick={() => onChange({ ...value, [r]: value[r] - 1 })} aria-label="-">
              −
            </button>
            <b className="picker-n">{value[r]}</b>
            <button className="step-btn" disabled={!canAdd} onClick={() => onChange({ ...value, [r]: value[r] + 1 })} aria-label="+">
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
      <span className="spinner" /> {t('conn.reconnecting')}
    </div>
  );
}
