/** Reine Floor-Helfer rund um Objekte und Maschinen. */
import { getItem, type MachineId } from '../offer/catalog';
import type { MachineState } from '../machine/machine';
import type { PlacedItem } from './types';

export function machineOf(item: PlacedItem): MachineState | null {
  if (getItem(item.catalogId).kind !== 'MACHINE') return null;
  return {
    id: item.id,
    catalogId: item.catalogId as MachineId,
    x: item.x,
    y: item.y,
    reels: item.reels,
    mods: item.mods,
    baseBet: item.baseBet,
  };
}

export function machinesOf(items: readonly PlacedItem[]): readonly MachineState[] {
  return items.flatMap((item) => {
    const machine = machineOf(item);
    return machine ? [machine] : [];
  });
}
