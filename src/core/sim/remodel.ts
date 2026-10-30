/** Umbau: Deckung pruefen, alle Gastansprueche abrechnen, dann das Haus tauschen. */
import type { Ledger } from '../economy/ledger';
import { canAfford, ZERO_VC } from '../economy/vacoin';
import { settleGuests } from './actions';
import { HAUSKONTO, SHOP } from './money';
import { createWorld, ensureStarter, TEMPLATE_COST } from './templates';
import type { TemplateId, WorldState } from './types';

export function remodel(world: WorldState, ledger: Ledger, template: TemplateId, tick: number): WorldState {
  if (template === world.template) return world;
  const cost = TEMPLATE_COST[template];
  if (!canAfford(ledger.getBalance(HAUSKONTO), cost)) {
    throw new Error('Das Hauskonto deckt diesen Umbau nicht.');
  }
  // Erst abrechnen: ein Fehlschlag bricht ab, bevor Geld fliesst oder Gaeste verschwinden.
  settleGuests(world, ledger);
  if (cost > ZERO_VC) ledger.transfer(HAUSKONTO, SHOP, cost, `umbau ${template}`, tick);
  const next = createWorld(template, world.carpet);
  ensureStarter(next);
  return next;
}
