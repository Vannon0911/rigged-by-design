/** Umbau: Deckung pruefen, alle Gastansprueche abrechnen, dann das Haus tauschen. */
import type { Ledger } from '../economy/ledger';
import { canAfford, ZERO_VC } from '../economy/vacoin';
import { settleGuests } from './actions';
import { HAUSKONTO, SHOP } from './money';
import { createWorld, ensureStarter, TEMPLATE_COST } from './templates';
import type { TemplateId, WorldState } from './types';

const REQUIREMENTS: Readonly<Record<TemplateId, { day: number; reputation: number; served: number } | null>> = {
  SMALL: null,
  MEDIUM: { day: 4, reputation: 35, served: 25 },
  LARGE: { day: 8, reputation: 55, served: 80 },
};

export function remodelRequirements(template: TemplateId): { day: number; reputation: number; served: number } | null {
  return REQUIREMENTS[template];
}

export function remodel(world: WorldState, ledger: Ledger, template: TemplateId, tick: number): WorldState {
  if (template === world.template) return world;
  const requirement = REQUIREMENTS[template];
  if (requirement && (world.day < requirement.day || world.reputation < requirement.reputation
    || world.guestsServed < requirement.served)) {
    throw new Error(
      `Voraussetzung für ${template}: Tag ${requirement.day}, Ruf ${requirement.reputation}, ${requirement.served} bediente Gäste.`,
    );
  }
  const cost = TEMPLATE_COST[template];
  if (!canAfford(ledger.getBalance(HAUSKONTO), cost)) {
    throw new Error('Das Hauskonto deckt diesen Umbau nicht.');
  }
  // Erst abrechnen: ein Fehlschlag bricht ab, bevor Geld fliesst oder Gaeste verschwinden.
  settleGuests(world, ledger);
  if (cost > ZERO_VC) ledger.transfer(HAUSKONTO, SHOP, cost, `umbau ${template}`, tick);
  const next = createWorld(template, world.carpet);
  next.wallColor = world.wallColor;
  next.neonColor = world.neonColor;
  next.barLevel = world.barLevel;
  next.wcLevel = world.wcLevel;
  ensureStarter(next);
  return next;
}
