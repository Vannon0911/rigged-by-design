/** HUD: ein Blick auf Hauskonto, Gäste und die drei Dinge, die jetzt zählen. */
import type { GameView } from '../store/types';
import { vc } from './format';

export interface HudProps {
  readonly view: GameView;
  readonly onBuild: () => void;
  readonly onGuests: () => void;
  readonly onVisit: () => void;
  readonly onClean: () => void;
  readonly onTakeHome: () => void;
}

const MOOD_LABEL = (mood: number): string => (mood >= 65 ? 'gut' : mood >= 40 ? 'gemischt' : 'gereizt');

export function Hud({ view, onBuild, onGuests, onVisit, onClean, onTakeHome }: HudProps) {
  const dirty = view.dirtyTiles.length;
  const startTip = view.house === 0 && view.guests.length === 0;
  const mood = view.guests.length ? view.mood : 0;
  return (
    <header className="hud">
      <div className="hud-brand">
        <span className="hud-mark">R</span>
        <div>
          <strong>RIGGED BY DESIGN</strong>
          <small>DEIN CASINO · TAG {view.day}</small>
        </div>
      </div>

      <div className="hud-money">
        <span>HAUSKONTO</span>
        <strong>{vc(view.house, view.house < 1000 * 10_000 ? 2 : 0)}</strong>
        <small>
          Portemonnaie {vc(view.wallet, 2)} · Kasse {vc(view.desk, 2)}
        </small>
      </div>

      <div className="hud-vitals">
        <div className={`vital${view.pending > 0 ? ' hot' : ''}`}>
          <span>OFFEN</span>
          <strong>{vc(view.pending, 2)}</strong>
          <small>{view.pending > 0 ? 'Gastgewinne warten' : 'nichts offen'}</small>
        </div>
        <div className="vital">
          <span>GÄSTE</span>
          <strong>{view.guests.length}<em>/{view.capacity}</em></strong>
          <small>{view.guests.length ? `Laune ${MOOD_LABEL(mood)}` : 'noch leer'}</small>
        </div>
        <div className={`vital${dirty > 0 ? ' warn' : ''}`}>
          <span>ORDNUNG</span>
          <strong>{view.reputation}<em>%</em></strong>
          <small>{dirty > 0 ? `${dirty} Flecken` : 'sauber'}</small>
        </div>
      </div>

      <div className="hud-actions">
        <button type="button" className="btn primary" onClick={onBuild}>BAUEN</button>
        <button type="button" className={`btn${view.pending > 0 ? ' alert' : ''}`} onClick={onGuests}>
          GÄSTE{view.pending > 0 ? <b className="badge">{view.guests.filter((g) => (view.guestMoney[g.id]?.pending ?? 0) > 0).length}</b> : null}
        </button>
        <button type="button" className="btn" onClick={onVisit}>FREMDES HAUS</button>
        <button type="button" className={`btn${dirty > 0 ? ' warm' : ''}`} onClick={onClean}>
          PUTZEN{dirty > 0 ? <b className="badge">{dirty}</b> : null}
        </button>
        <button type="button" className="btn ghost" disabled={view.house <= 0} onClick={onTakeHome} title="Geld vom Hauskonto ins Portemonnaie">
          ABHEBEN
        </button>
      </div>

      {startTip && (
        <div className="hud-tip">
          <span>0 VC. Dein Automat steht gratis.</span>
          <span>Gäste kommen zum Eingang, wechseln an der Kasse und spielen.</span>
        </div>
      )}
    </header>
  );
}
