/** HUD: Bargeld als Held, Tresor, Gäste und vier Aktionen. */
import { ZERO_VC, toVCString } from '../core/economy/vacoin';
import { getVenue } from '../core/venues';
import type { GameSnapshot } from '../store/types';

export interface HudProps {
  readonly snapshot: GameSnapshot;
  readonly onBuild: () => void;
  readonly onGuests: () => void;
  readonly onVisit: () => void;
  readonly onUpgrade: () => void;
  readonly onWithdraw: () => void;
  readonly onPayAll: () => void;
}

export function Hud({ snapshot, onBuild, onGuests, onVisit, onUpgrade, onWithdraw, onPayAll }: HudProps) {
  const capacity = getVenue(snapshot.venueTier).maxVisitors;
  const waiting = snapshot.visitors.filter((visitor) => visitor.pendingPayout > ZERO_VC && visitor.patience <= 0).length;
  const startTip = snapshot.tick < 25 && snapshot.cash <= ZERO_VC && snapshot.ownedReels.length > 0;
  const machineWord = snapshot.machines.length === 1 ? 'Automat' : 'Automaten';
  const upgrade = snapshot.upgrade;
  return (
    <header className="hud">
      <div className="hud-brand">
        <span className="hud-mark">VC</span>
        <div>
          <strong>RIGGED BY DESIGN</strong>
          <small>DEIN CASINO. DEINE REGELN.</small>
        </div>
      </div>

      <div className="hud-cash">
        <span>BARGELD</span>
        <strong>{toVCString(snapshot.cash)}</strong>
        <small>{snapshot.venueName} · Stufe {snapshot.venueTier}/4</small>
        {startTip && <small className="hud-tip">Klick den Automaten · Gratis-Walze bereit</small>}
      </div>

      <div className="hud-row">
        <div className={`hud-stat vault${waiting > 0 ? ' warn' : ''}`}>
          <span>TRESOR</span>
          <strong>{toVCString(snapshot.vault)}</strong>
          <small className="vault-line">
            <button
              type="button"
              className="vault-withdraw"
              disabled={snapshot.vault <= ZERO_VC}
              onClick={onWithdraw}
              title="Tresor komplett in die Kasse"
            >
              ABHEBEN
            </button>
            {waiting > 0
              ? `${waiting} ${waiting === 1 ? 'Gast wartet' : 'Gäste warten'} auf Kasse`
              : `Gewinne offen ${toVCString(snapshot.pending)}`}
            {waiting > 0 && (
              <button type="button" className="vault-withdraw gold" onClick={onPayAll}>ALLE ZAHLEN</button>
            )}
          </small>
        </div>
        <div className="hud-stat">
          <span>GÄSTE</span>
          <strong>{snapshot.visitors.length}/{capacity}</strong>
          <small>{snapshot.machines.length} {machineWord}{waiting > 0 ? ` · ${waiting} an der Kasse` : ''}</small>
        </div>
      </div>

      <div className="hud-actions">
        <button type="button" className="hud-cta" onClick={onBuild}>+ BAUEN</button>
        <button type="button" className={waiting > 0 ? 'attention' : undefined} onClick={onGuests}>
          GÄSTE{waiting > 0 ? ` (${waiting})` : ''}
        </button>
        <button type="button" onClick={onVisit}>FREMDES HAUS</button>
        <button
          type="button"
          onClick={onUpgrade}
          disabled={!upgrade?.available}
          title={upgrade ? (upgrade.available ? upgrade.name : upgrade.blockers.join(' · ')) : 'Maximale Stufe'}
        >
          {upgrade ? `AUSBAUEN ${toVCString(upgrade.cost)}` : 'MAX. STUFE'}
        </button>
      </div>
    </header>
  );
}
