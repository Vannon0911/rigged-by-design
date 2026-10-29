/** Gäste wählen nach Angebot: Anziehung, Geschmack, Reibung am Mindesteinsatz. */
import type { MachineState } from '../machine/machine';
import { attractionOf, tagsOf, totalBetOf } from '../machine/machine';
import type { Prng } from '../rng/prng';
import { pickWeightedIndex } from '../rng/weighted-pool';
import { getPersona } from './persona';
import type { Visitor } from './visitor';

/** 0 = unspielbar. Höher = attraktiver. */
export function offerScore(visitor: Visitor, machine: MachineState): number {
  const persona = getPersona(visitor.persona);
  const totalBet = totalBetOf(machine);
  if (totalBet <= 0 || totalBet > visitor.wallet) return 0;

  const taste = tagsOf(machine).reduce((sum, tag) => sum + (persona.taste[tag] ?? 0), 0);
  const walletShare = totalBet / Math.max(1, visitor.wallet);
  const tolerance = visitor.addiction >= 100 ? 0.6 : 0.25;
  const friction = walletShare > tolerance ? Math.round(600 * walletShare) : 0;

  return Math.max(1, 1000 + attractionOf(machine) / 2 + taste - friction);
}

export function chooseMachine(visitor: Visitor, machines: readonly MachineState[], prng: Prng): MachineState | null {
  const entries = machines
    .map((machine) => ({ value: machine, weight: offerScore(visitor, machine) }))
    .filter((entry) => entry.weight > 0);
  if (entries.length === 0) return null;
  const machine = entries[pickWeightedIndex(entries, prng)]!.value;
  visitor.target = machine.id;
  return machine;
}
