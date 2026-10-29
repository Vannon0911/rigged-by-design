/** Gästetypen: Budget, Geduld, Suchtneigung und Geschmack. Keine Statisten. */
import type { OfferTag } from '../offer/tags';
import type { VenueTier } from '../venues';

export type PersonaId = 'LUMPEN' | 'STREET' | 'BUSINESS' | 'HIGH_ROLLER' | 'STAMMGAST';

export interface Persona {
  readonly id: PersonaId;
  readonly name: string;
  readonly description: string;
  /** Multiplikator auf das Venue-Budget. */
  readonly budgetFactor: number;
  readonly patience: number;
  readonly addictionRate: number;
  readonly taste: Readonly<Partial<Record<OfferTag, number>>>;
  readonly color: number;
  readonly minVenueTier: VenueTier;
}

export const PERSONAS: readonly Persona[] = [
  {
    id: 'LUMPEN',
    name: 'Lumpen',
    description: 'Letztes Kleingeld, viel Zeit, wenig Anspruch.',
    budgetFactor: 0.45,
    patience: 115,
    addictionRate: 1.15,
    taste: { CLASSIC: 400, BOOZE: 300, NEON: -150 },
    color: 0x8d99ae,
    minVenueTier: 1,
  },
  {
    id: 'STREET',
    name: 'Straßentyp',
    description: 'Kommt für das Licht und bleibt für den Kick.',
    budgetFactor: 1,
    patience: 95,
    addictionRate: 1,
    taste: { NEON: 220, CLASSIC: 140, BOOZE: 120 },
    color: 0x00ffcc,
    minVenueTier: 1,
  },
  {
    id: 'BUSINESS',
    name: 'Business',
    description: 'Hat Geld, wenig Zeit und ein Auge für teure Automaten.',
    budgetFactor: 2.2,
    patience: 80,
    addictionRate: 0.9,
    taste: { HIGH_STAKES: 320, NEON: 160, BOOZE: -120 },
    color: 0xffd166,
    minVenueTier: 2,
  },
  {
    id: 'HIGH_ROLLER',
    name: 'High Roller',
    description: 'Spielt nur, wo der Mindesteinsatz wehtut.',
    budgetFactor: 5,
    patience: 70,
    addictionRate: 0.8,
    taste: { HIGH_STAKES: 620, NEON: 120, CLASSIC: -320 },
    color: 0xff2e88,
    minVenueTier: 3,
  },
  {
    id: 'STAMMGAST',
    name: 'Stammgast',
    description: 'Kennt deinen Automaten besser als du. Kommt immer wieder.',
    budgetFactor: 0.85,
    patience: 135,
    addictionRate: 1.5,
    taste: { NEON: 300, BOOZE: 260, HIGH_STAKES: 100 },
    color: 0xb06bff,
    minVenueTier: 1,
  },
];

const PERSONA_INDEX = new Map(PERSONAS.map((persona) => [persona.id, persona]));

export function getPersona(id: PersonaId): Persona {
  const persona = PERSONA_INDEX.get(id);
  if (!persona) throw new Error(`Unbekannter Gästetyp: ${id}`);
  return persona;
}

export function personasForVenue(tier: VenueTier): readonly Persona[] {
  return PERSONAS.filter((persona) => persona.minVenueTier <= tier);
}
