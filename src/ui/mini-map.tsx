/** Übersicht: 30x30-Regionen als Karte, Klick zoomt hinein. Kamera folgt nur auf Wunsch. */
import { REGION } from '../core/sim/types';
import type { GameView } from '../store/types';

interface Props {
  readonly view: GameView;
  readonly onZone: (id: string) => void;
  readonly onFit: () => void;
  readonly onZoomIn: () => void;
  readonly onZoomOut: () => void;
}

const hex = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;

export function MiniMap({ view, onZone, onFit, onZoomIn, onZoomOut }: Props) {
  return (
    <div className="minimap">
      <div className="minimap-head">
        <span>ÜBERSICHT</span>
        <small>{view.size / REGION}×{view.size / REGION} REGIONEN · 30×30</small>
      </div>
      <div className="minimap-map" role="group" aria-label="Zonen">
        {view.zones.map((zone) => (
          <button
            key={zone.id}
            type="button"
            className="mini-zone"
            title={zone.name}
            onClick={() => onZone(zone.id)}
            style={{
              left: `${(zone.x / view.size) * 100}%`,
              top: `${(zone.y / view.size) * 100}%`,
              width: `${(zone.w / view.size) * 100}%`,
              height: `${(zone.h / view.size) * 100}%`,
              background: hex(zone.color),
            }}
          />
        ))}
        {view.guests.map((guest) => (
          <i
            key={guest.id}
            className={`mini-guest${guest.state === 'ANGRY' ? ' angry' : ''}`}
            style={{ left: `${(guest.position.x / view.size) * 100}%`, top: `${(guest.position.y / view.size) * 100}%` }}
          />
        ))}
      </div>
      <div className="minimap-controls">
        <button type="button" className="btn tiny" onClick={onZoomOut} aria-label="Herauszoomen">−</button>
        <button type="button" className="btn tiny" onClick={onFit}>ALLES</button>
        <button type="button" className="btn tiny" onClick={onZoomIn} aria-label="Hineinzoomen">+</button>
      </div>
    </div>
  );
}
