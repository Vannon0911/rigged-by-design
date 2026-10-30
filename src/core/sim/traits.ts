/** Gast-Erzeugung: Persona plus zufaellig verteilter Max-Pool fuer Laune, Geduld und Sucht. */
import { fromVC, type VaCoinMicro } from '../economy/vacoin';
import type { Prng } from '../rng/prng';
import { getPersona, personasForTier } from './personas';
import type { Guest, PersonaId, Point, TemplateId } from './types';

const NAMES = ['Kai', 'Rita', 'Bruno', 'Nadja', 'Otis', 'Mira', 'Falk', 'Sina', 'Timo', 'Lena', 'Emil', 'Jule', 'Mika'];
const LAST_NAMES = ['Vogt', 'Berger', 'Kern', 'Roth', 'Adler', 'Busch', 'Dorn', 'Fink', 'Held', 'Kraus'];
const POOL = 200;
const TIER: Record<TemplateId, 1 | 2 | 3> = { SMALL: 1, MEDIUM: 2, LARGE: 3 };
const PERSONA_WEIGHT: Record<PersonaId, number> = {
  LUMPEN: 4, STREET: 4, BUSINESS: 2, HIGH_ROLLER: 1, STAMMGAST: 3,
};

/** Verteilt exakt 200 Punkte auf die drei Kernwerte; jeder bleibt in 0..100. */
function splitPool(prng: Prng): [number, number, number] {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const mood = prng.nextInt(0, 100);
    const patience = prng.nextInt(0, 100);
    const addiction = POOL - mood - patience;
    if (addiction >= 0 && addiction <= 100) return [mood, patience, addiction];
  }
  return [70, 70, 60];
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
  spawn: Point;
}): Guest {
  const persona = getPersona(input.persona);
  const [mood, patience, addiction] = splitPool(input.prng);
  return {
    id: input.id,
    name: `${NAMES[input.prng.nextInt(0, NAMES.length - 1)]!} ${LAST_NAMES[input.prng.nextInt(0, LAST_NAMES.length - 1)]!}`,
    persona: persona.id,
    mood,
    patience,
    addiction,
    sociability: input.prng.nextInt(30, 100),
    state: 'ENTER',
    stateTicks: 0,
    position: { ...input.spawn },
    path: [],
    pathIndex: 0,
    targetFurniture: 0,
    targetZone: 'entrance',
    queueIndex: 0,
    need: 'play',
    anger: 0,
    dirtTimer: 0,
    lastResult: '',
    spins: 0,
  };
}
