import { toVCString, type VaCoinMicro } from '../core/economy/vacoin';
import { getVenue } from '../core/progression/venues-and-tiers';
import type { VenueTier } from '../core/progression/venues-and-tiers';
import type { FloorRoundEvent } from '../core/simulation/floor-events';
import type { PlacedItem } from '../core/simulation/floor-types';
import { getBuildable, type BuildableId, type BuildableKind } from '../core/simulation/catalog';
import { gameStore } from '../store/use-game-store';

export interface FloorSelection {
  readonly x: number;
  readonly y: number;
  readonly item?: PlacedItem;
}

export interface FloorActionPanelProps {
  readonly selection: FloorSelection;
  readonly tier: VenueTier;
  readonly cash: VaCoinMicro;
  readonly events: readonly FloorRoundEvent[];
  readonly onClose: () => void;
  readonly onWorkshop: () => void;
  readonly onPlay: (kind: Exclude<BuildableKind, 'DECO'>) => void;
}

export function FloorActionPanel({ selection, tier, cash, events, onClose, onWorkshop, onPlay }: FloorActionPanelProps) {
  const item = selection.item;
  const buildable = item ? getBuildable(item.buildableId) : null;
  const venue = getVenue(tier);
  const available = venue.allowedBuildables.map((id) => getBuildable(id));
  const recent = events.filter((event) => event.gameX === selection.x && event.gameY === selection.y).slice(-3).reverse();
  const canPlay = buildable && buildable.kind !== 'DECO';

  return (
    <aside className="floor-action-panel" aria-label={item ? 'Gerät ausgewählt' : 'Feld bebauen'}>
      <header>
        <div>
          <span>{item ? 'DEIN GERÄT' : 'FREIES FELD'}</span>
          <strong>{buildable ? buildable.name : `Feld ${selection.x} / ${selection.y}`}</strong>
        </div>
        <button type="button" onClick={onClose} aria-label="Schließen">×</button>
      </header>

      {item && buildable ? (
        <>
          <p>{buildable.description}</p>
          <p className="floor-panel-meta">
            {buildable.kind} · {item.mods.length} Betreiber-Mods · {recent.length} letzte Runden
          </p>
          {recent.length > 0 && (
            <div className="floor-event-mini">
              {recent.map((event) => (
                <span key={event.seq} className={event.isWin ? 'win' : ''}>
                  {event.visitorName}: {event.isWin ? `+${toVCString(event.net)}` : toVCString(event.net)}
                </span>
              ))}
            </div>
          )}
          {canPlay && (
            <button type="button" className="floor-primary" onClick={() => onPlay(buildable.kind as Exclude<BuildableKind, 'DECO'>)}>
              {buildable.kind === 'SLOT' ? 'AM GERÄT SPIELEN' : 'EIGENEN TISCH ÖFFNEN'}
            </button>
          )}
          <button type="button" onClick={onWorkshop}>SUCHT-WERKSTATT ÖFFNEN</button>
        </>
      ) : (
        <>
          <p>Wähle ein Objekt. Der Preis wird sofort aus deiner Brieftasche gebucht.</p>
          <div className="floor-build-list">
            {available.map((entry) => (
              <button
                type="button"
                key={entry.id}
                disabled={cash < entry.priceVC}
                onClick={() => { gameStore.build(entry.id as BuildableId, selection.x, selection.y); onClose(); }}
              >
                <span>{entry.name}</span>
                <strong>{toVCString(entry.priceVC)}</strong>
              </button>
            ))}
          </div>
          <p className="floor-panel-meta">{venue.gridSize}×{venue.gridSize} · Stufe {venue.tier} · {toVCString(cash)} verfügbar</p>
        </>
      )}
    </aside>
  );
}
