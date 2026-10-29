/** Selbst öffnendes/schließendes Spiel-Fenster über der Casino-Fläche. */
import type { ReactNode } from 'react';

export interface GameWindowProps {
  readonly title: string;
  readonly children: ReactNode;
  readonly onClose: () => void;
}

export function GameWindow({ title, children, onClose }: GameWindowProps) {
  return (
    <div
      className="game-window-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="game-window" role="dialog" aria-modal="true" aria-label={title}>
        <header>
          <div>
            <span className="stage-caption">Live-Tisch</span>
            <h2>{title}</h2>
          </div>
          <button type="button" className="game-window-close" aria-label="Fenster schließen" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="game-window-body">{children}</div>
      </section>
    </div>
  );
}
