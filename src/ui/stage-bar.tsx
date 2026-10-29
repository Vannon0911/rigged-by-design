/** Umschalter und Beschriftung der Pixi-Buehne. */
export type StageMode = 'SLOT' | 'FLOOR' | 'TABLES';

const MODES: readonly { readonly id: StageMode; readonly label: string }[] = [
  { id: 'SLOT', label: 'Slot-Automat' },
  { id: 'FLOOR', label: '8×8 Floor' },
  { id: 'TABLES', label: 'Hütchen & Würfel' },
];

export interface StageBarProps {
  readonly mode: StageMode;
  readonly caption: string;
  readonly onSelect: (mode: StageMode) => void;
}

export function StageBar({ mode, caption, onSelect }: StageBarProps) {
  return (
    <div className="stage-bar">
      <div className="segmented">
        {MODES.map((entry) => (
          <button
            type="button"
            key={entry.id}
            className={entry.id === mode ? 'active' : ''}
            onClick={() => onSelect(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <span className="stage-caption">{caption}</span>
    </div>
  );
}
