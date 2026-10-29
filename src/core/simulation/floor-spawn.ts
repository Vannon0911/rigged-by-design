/** Spawnt einen Besucher, bucht den Buy-in und wendet den Fusel-Spender an. */
import type { Ledger } from '../economy/ledger';
import type { Prng } from '../rng/prng';
import { getBuildable } from './catalog';
import type { PlacedItem } from './floor-types';
import { admitVisitor } from './visitor-ledger';
import { rollVisitor, type Visitor } from './visitors';

export interface SpawnVisitorInput {
  readonly ledger: Ledger;
  readonly prng: Prng;
  readonly id: number;
  readonly items: readonly PlacedItem[];
  readonly startingAddiction: number;
  readonly tick: number;
  readonly budgetMin?: number;
  readonly budgetMax?: number;
}

export function spawnVisitor(input: SpawnVisitorInput): Visitor {
  const visitor = rollVisitor(
    input.id,
    input.prng,
    input.startingAddiction,
    input.budgetMin !== undefined && input.budgetMax !== undefined
      ? { min: input.budgetMin as Visitor['wallet'], max: input.budgetMax as Visitor['wallet'] }
      : undefined,
  );
  admitVisitor(input.ledger, visitor, input.tick);

  const dispenser = input.items.find((item) => getBuildable(item.buildableId).boozePatience > 0);
  if (dispenser) {
    const buildable = getBuildable(dispenser.buildableId);
    if (input.ledger.getBalance('CASINO_VAULT') >= buildable.operatingCostVC) {
      input.ledger.transfer('CASINO_VAULT', 'EXTERNAL_WORK', buildable.operatingCostVC, 'booze dispenser', input.tick);
      visitor.patience = Math.min(100, visitor.patience + buildable.boozePatience);
    }
  }

  return visitor;
}
