import { toVCString, type VaCoinMicro } from '../../core/economy/vacoin';
import {
  getBuildable,
  getOperatorMod,
  operatorModsFor,
  type OperatorTarget,
} from '../../core/simulation/catalog';
import type { PlacedItem } from '../../core/simulation/floor-types';
import type { VenueTier } from '../../core/progression/venues-and-tiers';
import { gameStore } from '../../store/use-game-store';

export interface OperatorModPanelProps {
  readonly placements: readonly PlacedItem[];
  readonly tier: VenueTier;
  readonly cash: VaCoinMicro;
}

const KINDS = new Set<string>(['SLOT', 'SHELL', 'DICE', 'ROULETTE', 'BLACKJACK', 'POKER']);

export function OperatorModPanel({ placements, tier, cash }: OperatorModPanelProps) {
  const games = placements.filter((item) => KINDS.has(getBuildable(item.buildableId).kind));
  if (games.length === 0) return <p className="hint">Baue erst ein Spiel auf, dann kannst du Betreiber-Mods einbauen.</p>;

  return (
    <div className="operator-mods">
      {games.map((item) => {
        const buildable = getBuildable(item.buildableId);
        const target = buildable.kind as OperatorTarget;
        const available = operatorModsFor(target, tier);
        if (available.length === 0 && item.mods.length === 0) return null;
        const freeSlots = Math.max(0, buildable.maxMods - item.mods.length);
        return (
          <article className="operator-mod-row" key={item.id}>
            <header>
              <strong>{buildable.name} #{item.id}</strong>
              <span>{item.mods.length} / {buildable.maxMods} Mods</span>
            </header>
            {item.mods.length > 0 && (
              <p className="hint">{item.mods.map((id) => getOperatorMod(id).name).join(' · ')}</p>
            )}
            <div className="operator-mod-list">
              {available.filter((mod) => !item.mods.includes(mod.id)).map((mod) => (
                <button
                  type="button"
                  key={mod.id}
                  disabled={freeSlots === 0 || cash < mod.priceVC || mod.minVenueTier > tier}
                  title={mod.description}
                  onClick={() => gameStore.installOperatorMod(item.id, mod.id)}
                >
                  {mod.name} · {toVCString(mod.priceVC)}
                </button>
              ))}
              {freeSlots === 0 && <small>Maximale Mod-Zahl erreicht.</small>}
            </div>
          </article>
        );
      })}
    </div>
  );
}
