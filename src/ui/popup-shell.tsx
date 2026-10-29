/** Ein Rahmen für alle Popups: Backdrop, Titel, Escape, Schließen. */
import { useEffect, type ReactNode } from 'react';

export interface PopupShellProps {
  readonly eyebrow: string;
  readonly title: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
  readonly wide?: boolean;
}

export function PopupShell({ eyebrow, title, onClose, children, wide = false }: PopupShellProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="popup-backdrop"
      role="presentation"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className={wide ? 'popup popup-wide' : 'popup'} role="dialog" aria-modal="true" aria-label={title}>
        <header className="popup-head">
          <div>
            <span className="eyebrow">{eyebrow}</span>
            <h2>{title}</h2>
          </div>
          <button type="button" className="popup-close" aria-label="Schließen" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="popup-body">{children}</div>
      </section>
    </div>
  );
}
