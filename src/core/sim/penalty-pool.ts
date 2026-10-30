/** Straf-Event-Pool nach einer verlorenen Prügelei. Geld läuft ausschließlich über das Ledger. */
import type { Ledger } from '../economy/ledger';
import type { VaCoinMicro } from '../economy/vacoin';
import type { Prng } from '../rng/prng';
import { HAUSKONTO } from './money';
import type { ActivePenalty, WorldState } from './types';

export type PenaltyKind = 'UNSAFE_REPUTATION' | 'MOOD_SHOCK' | 'ROBBERY';

export const ROBBERY_ACCOUNT = 'EXTERNAL_ROBBERY';
export const UNSAFE_REPUTATION_SPAWN_FACTOR = 0.55;
export const MOOD_SHOCK_NEWCOMER_MALUS = 20;

const PENALTY_KINDS: readonly PenaltyKind[] = ['UNSAFE_REPUTATION', 'MOOD_SHOCK', 'ROBBERY'];

export function rollPenalty(prng: Prng): PenaltyKind {
  return PENALTY_KINDS[prng.nextInt(0, PENALTY_KINDS.length - 1)]!;
}

/** Wendet genau einen Straf-Event an. Der Raub liefert den erbeuteten Betrag zurück. */
export function applyPenalty(world: WorldState, ledger: Ledger, prng: Prng, kind: PenaltyKind): number {
  if (kind === 'UNSAFE_REPUTATION') {
    world.activePenalties.push({ kind, daysLeft: prng.nextInt(2, 4) } satisfies ActivePenalty);
    world.lastEvent = 'Es spricht sich herum: Dein Laden ist unsicher.';
    return 0;
  }
  if (kind === 'MOOD_SHOCK') {
    for (const guest of world.guests) {
      guest.mood = Math.max(0, guest.mood - 35);
      guest.patience = Math.max(0, guest.patience - 25);
    }
    world.activePenalties.push({ kind, daysLeft: prng.nextInt(2, 3) } satisfies ActivePenalty);
    world.lastEvent = 'Schockwelle im Casino: Alle Gäste sind verstört.';
    return 0;
  }
  const percent = prng.nextInt(15, 35);
  const house = ledger.getBalance(HAUSKONTO);
  const stolen = Math.floor((house * percent) / 100) as VaCoinMicro;
  if (stolen <= 0) return 0;
  ledger.transfer(HAUSKONTO, ROBBERY_ACCOUNT, stolen, 'Ausgeraubt nach verlorener Prügelei', world.tick);
  world.lastEvent = `Der Typ hat uns ausgeraubt und ${percent} % erbeutet!`;
  return stolen;
}

/** Zählt die Straf-Tage bei jedem Tageswechsel herunter und entfernt abgelaufene Strafen. */
export function tickPenaltyDays(world: WorldState): void {
  for (const penalty of world.activePenalties) penalty.daysLeft -= 1;
  world.activePenalties = world.activePenalties.filter((penalty) => penalty.daysLeft > 0);
}
