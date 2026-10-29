/** Spawnt einen Gast: Persona nach Venue, Budget aus der Venue, Buy-in gegen EXTERNAL_WORK. */
import type { Ledger } from '../economy/ledger';
import { fromVC, type VaCoinMicro } from '../economy/vacoin';
import type { Prng } from '../rng/prng';
import { pickWeightedIndex } from '../rng/weighted-pool';
import { getVenue, type VenueTier } from '../venues';
import { getPersona, personasForVenue, type Persona } from './persona';
import { admitVisitor } from './ledger';
import type { Visitor } from './visitor';

const NAMES = ['Kai', 'Rita', 'Bruno', 'Nadja', 'Otis', 'Mira', 'Falk', 'Sina', 'Timo', 'Lena', 'Emil', 'Jule'];
const PERSONA_WEIGHTS: Readonly<Record<VenueTier, Partial<Record<Persona['id'], number>>>> = {
  1: { LUMPEN: 4, STREET: 4, STAMMGAST: 2 },
  2: { LUMPEN: 2, STREET: 4, BUSINESS: 3, STAMMGAST: 2 },
  3: { STREET: 2, BUSINESS: 4, HIGH_ROLLER: 2, STAMMGAST: 2 },
  4: { BUSINESS: 3, HIGH_ROLLER: 4, STAMMGAST: 2 },
};

export interface SpawnInput {
  readonly ledger: Ledger;
  readonly prng: Prng;
  readonly id: number;
  readonly venueTier: VenueTier;
  readonly startingAddiction: number;
  readonly patienceBonus: number;
  readonly tick: number;
}

export function spawnVisitor(input: SpawnInput): Visitor {
  const venue = getVenue(input.venueTier);
  const personas = personasForVenue(input.venueTier);
  const weights = PERSONA_WEIGHTS[input.venueTier];
  const entries = personas.map((persona) => ({ value: persona, weight: weights[persona.id] ?? 1 }));
  const persona = entries[pickWeightedIndex(entries, input.prng)]!.value;
  const min = Math.max(1, Math.round(venue.budgetMinVC * persona.budgetFactor));
  const max = Math.max(min, Math.round(venue.budgetMaxVC * persona.budgetFactor));
  const wallet = Math.max(1, input.prng.nextInt(min, max)) as VaCoinMicro;
  const patience = Math.max(20, Math.min(160, persona.patience + input.patienceBonus));

  const visitor: Visitor = {
    id: input.id,
    name: `${NAMES[input.prng.nextInt(0, NAMES.length - 1)]!} ${input.id}`,
    persona: persona.id,
    buyIn: wallet,
    wallet,
    pendingPayout: 0 as VaCoinMicro,
    patience,
    addiction: Math.min(80, input.startingAddiction + input.prng.nextInt(0, 8)),
    spins: 0,
    target: 0,
  };
  admitVisitor(input.ledger, visitor, input.tick);
  return visitor;
}

/** Nur fuer Tests und UI-Vorschauen: gleiche Persona, festes Budget. */
export function makeVisitor(personaId: Persona['id'], walletVC: number, id = 1): Visitor {
  const persona = getPersona(personaId);
  const wallet = fromVC(walletVC);
  return {
    id,
    name: `${persona.name} ${id}`,
    persona: persona.id,
    buyIn: wallet,
    wallet,
    pendingPayout: 0 as VaCoinMicro,
    patience: persona.patience,
    addiction: 0,
    spins: 0,
    target: 0,
  };
}
