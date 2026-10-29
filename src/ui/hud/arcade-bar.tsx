import { toVCString, type VaCoinMicro } from '../../core/economy/vacoin';
import { useProgressionStore } from '../../store/progression-store';

export type HudSection = 'CASINO' | 'CPU' | 'WORKSHOP' | 'CHARACTER';

const SECTIONS: readonly { id: HudSection; label: string; icon: string }[] = [
  { id: 'CASINO', label: 'Mein Casino', icon: '⌂' },
  { id: 'CPU', label: 'CPU-Casinos', icon: '◉' },
  { id: 'WORKSHOP', label: 'Sucht-Werkstatt', icon: '⚙' },
  { id: 'CHARACTER', label: 'Charakter & Mods', icon: '☠' },
];

function countdown(ticks: number): string {
  const safe = Math.max(0, Math.ceil(ticks));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

export interface ArcadeBarProps {
  readonly cash: VaCoinMicro;
  readonly vault: VaCoinMicro;
  readonly visitors: number;
  readonly avgAddiction: number;
  readonly ledgerOk: boolean;
  readonly notice: string;
  readonly section: HudSection;
  readonly onSection: (section: HudSection) => void;
  readonly onDeposit: () => void;
  readonly onWithdraw: () => void;
}

export function ArcadeBar(props: ArcadeBarProps) {
  const progression = useProgressionStore();
  const venue = progression.venue;

  return (
    <header className="arcade-bar">
      <div className="arcade-brand">
        <span className="arcade-mark">VC</span>
        <div>
          <strong>RIGGED BY DESIGN</strong>
          <small>EIN CASINO. DEINE REGELN.</small>
        </div>
      </div>

      <div className="arcade-stats">
        <div className="arcade-stat cash">
          <span>VACOINS</span>
          <strong>{toVCString(props.cash)}</strong>
        </div>
        <div className="arcade-stat">
          <span>STUFE {venue.tier} / 4</span>
          <strong>{venue.name}</strong>
          <small>{progression.cycle}. Zyklus · Tribut {countdown(progression.ticksUntilTribute)}</small>
        </div>
        <div className="arcade-stat">
          <span>GÄSTE · Ø SUCHT</span>
          <strong>{props.visitors} <em>/ {Math.round(props.avgAddiction)} %</em></strong>
          <small>Gewinne offen · Tresor {toVCString(props.vault)}</small>
        </div>
        <div className="arcade-vault">
          <button type="button" onClick={props.onDeposit} title="1.0000 VC in den Tresor">+</button>
          <button type="button" onClick={props.onWithdraw} title="1.0000 VC aus dem Tresor">−</button>
        </div>
        <span className={props.ledgerOk ? 'arcade-ledger ok' : 'arcade-ledger fail'} title="Ledger-Integrität">
          {props.ledgerOk ? '● GEDECKT' : '● FEHLER'}
        </span>
      </div>

      <nav className="arcade-nav" aria-label="Schnellwechsel">
        {SECTIONS.map((entry) => (
          <button
            type="button"
            key={entry.id}
            className={props.section === entry.id ? 'active' : ''}
            onClick={() => props.onSection(entry.id)}
          >
            <i>{entry.icon}</i>
            <span>{entry.label}</span>
          </button>
        ))}
      </nav>

      <p className="arcade-notice" aria-live="polite">
        <span>{progression.status === 'TRIBUTE_DUE' ? 'SYNDIKAT: TRIBUT FÄLLIG' : 'LIVE'}</span>
        {props.notice}
      </p>
    </header>
  );
}
