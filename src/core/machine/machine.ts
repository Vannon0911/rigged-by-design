/** Eine Maschine ist eine Konfiguration: Walzen, Mods, Einsatz. Alles andere ist Rendering. */
import { addVC, ZERO_VC, type VaCoinMicro } from '../economy/vacoin';
import { getItem, type MachineId } from '../offer/catalog';
import { modContracts, getMod, type ModId } from '../offer/mods';
import { getReel, type ReelId } from '../offer/reels';
import { synergyAddictionOf, synergyAttractionOf, synergyPatienceOf } from '../offer/synergy';
import type { OfferTag } from '../offer/tags';
import { resolvePaylines } from '../slot/slot-engine';
import type { SlotConfig } from '../slot/slot-types';

export interface MachineState {
  readonly id: number;
  readonly catalogId: MachineId;
  readonly x: number;
  readonly y: number;
  readonly reels: readonly ReelId[];
  readonly mods: readonly ModId[];
  readonly baseBet: VaCoinMicro;
}

export const MIN_REEL_SLOTS = 3;
export const MAX_REEL_SLOTS = 6;

/** Slot-Config fuer die Engine. Reels sind explizit, Paylines kommen aus Katalog + Mods. */
export function slotConfigOf(machine: MachineState): SlotConfig {
  const item = getItem(machine.catalogId);
  return {
    id: `machine-${machine.id}`,
    baseBet: machine.baseBet,
    reels: machine.reels.map((id) => ({ id, symbols: getReel(id).symbols })),
    paylines: item.paylines,
    mods: modContracts(machine.mods),
  };
}

export function reelSlotsOf(machine: MachineState): number {
  const extra = machine.mods.reduce((sum, id) => sum + getMod(id).reelSlots, 0);
  return Math.min(MAX_REEL_SLOTS, MIN_REEL_SLOTS + extra);
}

export function attractionOf(machine: MachineState): number {
  const base = getItem(machine.catalogId).attractionBps;
  return base + machine.mods.reduce((sum, id) => sum + getMod(id).attractionBps, 0) + synergyAttractionOf(machine.mods);
}

export function tagsOf(machine: MachineState): readonly OfferTag[] {
  const item = getItem(machine.catalogId);
  const modTags = machine.mods.map((id) => getMod(id).tag);
  return [...new Set([...item.tags, ...modTags])];
}

export function paylinesOf(machine: MachineState): number {
  return resolvePaylines(slotConfigOf(machine)).length;
}

export function totalBetOf(machine: MachineState): VaCoinMicro {
  const bet = machine.baseBet * paylinesOf(machine);
  return Number.isSafeInteger(bet) ? (bet as VaCoinMicro) : ZERO_VC;
}

export function patienceDeltaOf(machine: MachineState): number {
  return machine.mods.reduce((sum, id) => sum + getMod(id).patienceDelta, 0) + synergyPatienceOf(machine.mods);
}

export function addictionBonusOf(machine: MachineState): number {
  return machine.mods.reduce((sum, id) => sum + getMod(id).addictionBonus, 0) + synergyAddictionOf(machine.mods);
}

export function operatingCostOf(machine: MachineState): VaCoinMicro {
  return machine.mods.reduce((sum, id) => addVC(sum, getMod(id).operatingCostVC), ZERO_VC);
}
