/** Gast-Erzeugung: Persona plus zufaellig verteilter Max-Pool fuer Laune, Geduld, Sozialverhalten. */
import { fromVC, type VaCoinMicro } from '../economy/vacoin';
import type { Prng } from '../rng/prng';
import { getPersona, personasForTier } from './personas';
import type { Guest, PersonaId, Point, TemplateId } from './types';

const NAMES = ['Kai', 'Rita', 'Bruno', 'Nadja', 'Otis', 'Mira', 'Falk', 'Sina', 'Timo', 'Lena', 'Emil', 'Jule', 'Mika'];
const POOL = 240;
const TIER: Record<TemplateId, 1 | 2 | 3> = { SMALL: 1, MEDIUM: 2, LARGE: 3 };
const PERSONA_WEIGHT: Record<PersonaId, number> = {
  LUMPEN: 4, STREET: 4, BUSINESS: 2, HIGH_ROLLER: 1, STAMMGAST: 3,
};

/** Verteilt den Pool auf drei Stats: jeder 30..100, zusammen exakt 240. */
function splitPool(prng: Prng): [number, number, number] {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const mood = prng.nextInt(30, 100);
    const patience = prng.nextInt(30, 100);
    const social = POOL - mood - patience;
    if (social >= 30 && social <= 100) return [mood, patience, social];
  }
  return [80, 80, 80];
}

export function randomPersona(prng: Prng, template: TemplateId): PersonaId {
  const pool = personasForTier(TIER[template]);
  const total = pool.reduce((sum, persona) => sum + PERSONA_WEIGHT[persona.id], 0);
  let roll = prng.nextInt(1, total);
  for (const persona of pool) {
    roll -= PERSONA_WEIGHT[persona.id];
    if (roll <= 0) return persona.id;
  }
  return pool[0]!.id;
}

export function randomFiat(prng: Prng, template: TemplateId, personaId: PersonaId): VaCoinMicro {
  const base = TIER[template] === 1 ? 2 : TIER[template] === 2 ? 8 : 26;
  const persona = getPersona(personaId);
  return fromVC(Math.max(1, Math.round(base * persona.budgetFactor * (0.7 + prng.nextFloat() * 0.9))));
}

export function makeGuest(input: {
  id: number;
  persona: PersonaId;
  prng: Prng;
  fiat: VaCoinMicro;
  spawn: Point;
}): Guest {
  const persona = getPersona(input.persona);
  const [moodBase, patienceBase, social] = splitPool(input.prng);
  return {
    id: input.id,
    name: `${NAMES[input.prng.nextInt(0, NAMES.length - 1)]!} ${input.id}`,
    persona: persona.id,
    fiat: input.fiat,
    mood: Math.min(100, Math.round(moodBase * 0.85 + 12)),
    patience: Math.min(100, Math.round((patienceBase * 0.75 + 25) * (persona.patience / 100))),
    addiction: input.prng.nextInt(0, 9),
    sociability: social,
    state: 'ENTER',
    stateTicks: 0,
    position: { ...input.spawn },
    path: [],
    pathIndex: 0,
    targetFurniture: 0,
    targetZone: 'entrance',
    queueIndex: 0,
    need: 'play',
    bubble: 'Ich will spielen.',
    anger: 0,
    dirtTimer: 0,
    lastResult: '',
    spins: 0,
  };
}
