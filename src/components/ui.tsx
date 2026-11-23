import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import { Icon } from './Icon';
import { copyText } from '../lib/prompts';
import { CAMPAIGN_STATUS_LABELS, CHANNEL_LABELS, STATUS_LABELS } from '../lib/labels';
import type { CampaignStatus, Channel, PubStatus } from '../lib/types';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  variant = 'secondary',
  icon,
  small,
  children,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; icon?: string; small?: boolean }) {
  return (
    <button type="button" className={`btn btn-${variant}${small ? ' btn-sm' : ''}${!children ? ' btn-icon' : ''} ${className}`} {...rest}>
      {icon && <Icon name={icon} size={small ? 15 : 17} />}
      {children && <span>{children}</span>}
    </button>
  );
}

export function Field({ label, hint, children, className = '' }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={`field ${className}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function Modal({
  title,
  open,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      if (typeof d.showModal === 'function') d.showModal();
      else d.setAttribute('open', '');
      // showModal() focuses the first focusable element (the close button): move focus to the first field instead.
      // On touch screens, avoid popping the keyboard over the form.
      const touch = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
      const target =
        (!touch && d.querySelector<HTMLElement>('.modal-body input:not([type=hidden]):not([type=checkbox]), .modal-body textarea, .modal-body select')) ||
        d.querySelector<HTMLElement>('.modal-foot .btn-primary, .modal-foot .btn-danger');
      target?.focus();
    } else if (!open && d.open) {
      if (typeof d.close === 'function') d.close();
      else d.removeAttribute('open');
    }
  }, [open]);
  if (!open) return null;
  return (
    <dialog
      ref={ref}
      className={`modal${wide ? ' modal-wide' : ''}`}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-inner">
        <header className="modal-head">
          <h2 id={titleId}>{title}</h2>
          <Button variant="ghost" icon="x" aria-label="Fermer" onClick={onClose} />
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </dialog>
  );
}

// ---------- Confirm & prompt dialogs ----------

interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
}

type Toast = { id: number; text: string; tone: 'ok' | 'error' | 'info' };

interface UICtx {
  confirm: (o: ConfirmOptions) => Promise<boolean>;
  toast: (text: string, tone?: Toast['tone']) => void;
}

const UIContext = createContext<UICtx | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const confirm = useCallback((o: ConfirmOptions) => new Promise<boolean>((resolve) => setDialog({ ...o, resolve })), []);
  const toast = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 7000 : 3500);
  }, []);
  const close = (v: boolean) => {
    dialog?.resolve(v);
    setDialog(null);
  };
  return (
    <UIContext.Provider value={{ confirm, toast }}>
      {children}
      <Modal
        title={dialog?.title ?? ''}
        open={!!dialog}
        onClose={() => close(false)}
        footer={
          <>
            <Button onClick={() => close(false)}>Annuler</Button>
            <Button variant={dialog?.danger ? 'danger' : 'primary'} onClick={() => close(true)} autoFocus>
              {dialog?.confirmLabel ?? 'Confirmer'}
            </Button>
          </>
        }
      >
        <div className="confirm-message">{dialog?.message}</div>
      </Modal>
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`}>
            <Icon name={t.tone === 'error' ? 'alert' : t.tone === 'info' ? 'info' : 'check'} size={16} />
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </UIContext.Provider>
  );
}

export function useUI(): UICtx {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('UIProvider manquant');
  return ctx;
}

// ---------- Small display components ----------

export function StatusBadge({ status }: { status: PubStatus }) {
  return <span className={`badge status-${status}`}>{STATUS_LABELS[status]}</span>;
}

export function CampaignBadge({ status }: { status: CampaignStatus }) {
  return <span className={`badge cstatus-${status}`}>{CAMPAIGN_STATUS_LABELS[status]}</span>;
}

export function ChannelTag({ channel }: { channel: Channel }) {
  return <span className={`chip chip-${channel}`}>{CHANNEL_LABELS[channel]}</span>;
}

export function Empty({ icon = 'info', title, children, action }: { icon?: string; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <Icon name={icon} size={28} />
      <strong>{title}</strong>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function CopyButton({ text, label = 'Copier', small, variant = 'secondary' }: { text: string; label?: string; small?: boolean; variant?: Variant }) {
  const { toast } = useUI();
  const [done, setDone] = useState(false);
  return (
    <Button
      small={small}
      variant={variant}
      icon={done ? 'check' : 'copy'}
      onClick={async () => {
        const ok = await copyText(text);
        if (ok) {
          setDone(true);
          setTimeout(() => setDone(false), 1800);
          toast('Copié dans le presse-papiers');
        } else toast('Copie impossible : sélectionnez le texte et copiez-le manuellement.', 'error');
      }}
    >
      {done ? 'Copié' : label}
    </Button>
  );
}

export function Tabs<T extends string>({ value, onChange, items, label }: { value: T; onChange: (v: T) => void; items: { id: T; label: string; count?: number }[]; label: string }) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {items.map((i) => (
        <button key={i.id} type="button" role="tab" aria-selected={value === i.id} className={value === i.id ? 'active' : ''} onClick={() => onChange(i.id)}>
          {i.label}
          {i.count !== undefined && <span className="tab-count">{i.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p className="lede">{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function Progress({ value, label }: { value: number; label: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}
