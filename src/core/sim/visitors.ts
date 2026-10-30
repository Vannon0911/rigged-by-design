/** Besucherprofile: Gaeste bleiben ueber Besuche hinweg erkennbar; die Liste ist begrenzt. */
import type { PersonaId, Visitor, WorldState } from './types';

export const VISITOR_CAP = 40;
/** Anteil der Besuche (in Prozent), die von einem bekannten Gast kommen. */
const RETURN_PERCENT = 25;

/** Legt ein neues Profil an oder verdraengt bei vollem Speicher das am laengsten nicht gesehene. */
export function recordVisitor(
  world: WorldState,
  input: { name: string; persona: PersonaId; tick: number },
): Visitor {
  const visitor: Visitor = {
    id: world.nextVisitorId++,
    name: input.name,
    persona: input.persona,
    visits: 1,
    lastSeenTick: input.tick,
  };
  world.visitors.push(visitor);
  if (world.visitors.length > VISITOR_CAP) {
    let oldest = 0;
    for (let i = 1; i < world.visitors.length; i += 1) {
      if (world.visitors[i]!.lastSeenTick < world.visitors[oldest]!.lastSeenTick) oldest = i;
    }
    world.visitors.splice(oldest, 1);
  }
  return visitor;
}

/**
 * Waehlt deterministisch aus der Gast-ID (kein PRNG-Zug), damit der Zufallsablauf bestehender
 * Spielstaende und Tests unveraendert bleibt.
 */
export function pickReturningVisitor(world: WorldState, guestId: number): Visitor | null {
  if (world.visitors.length === 0) return null;
  const hash = Math.imul(guestId, 2654435761) >>> 0;
  if (hash % 100 >= RETURN_PERCENT) return null;
  return world.visitors[(hash >>> 8) % world.visitors.length] ?? null;
}

export function markReturning(visitor: Visitor, tick: number): void {
  visitor.visits += 1;
  visitor.lastSeenTick = tick;
}
