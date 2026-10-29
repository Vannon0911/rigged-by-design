/** Mod-Kombis: erst zwei passende Tags machen aus einem Automaten ein Angebot. */
import { getMod, type ModId } from './mods';
import type { OfferTag } from './tags';

export interface Synergy {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly a: OfferTag;
  readonly b: OfferTag;
  readonly attractionBps: number;
  readonly patienceDelta: number;
  readonly addictionBonus: number;
}

/** a === b verlangt zwei Mods dieses Tags, sonst je einen aus beiden Tags. */
export const SYNERGIES: readonly Synergy[] = [
  {
    id: 'SYN_NEON_OVERKILL',
    name: 'Neon-Overkill',
    description: 'Zwei Lichtquellen: Die Straße sieht dein Haus, bevor sie es hört.',
    a: 'NEON',
    b: 'NEON',
    attractionBps: 320,
    patienceDelta: -4,
    addictionBonus: 5,
  },
  {
    id: 'SYN_STAMMTISCH',
    name: 'Stammtisch',
    description: 'Kirschen und Fusel: dieselben Leute, jeden Abend, immer länger.',
    a: 'CLASSIC',
    b: 'BOOZE',
    attractionBps: 140,
    patienceDelta: 6,
    addictionBonus: 0,
  },
  {
    id: 'SYN_VABANQUE',
    name: 'Vabanque',
    description: 'Mehr Linien und mehr Walzen für Leute, die es sich leisten können.',
    a: 'SPEED',
    b: 'HIGH_STAKES',
    attractionBps: 300,
    patienceDelta: -2,
    addictionBonus: 4,
  },
  {
    id: 'SYN_VIP_LOGE',
    name: 'VIP-Loge',
    description: 'Neon für die Menge, Hochmut für die, die vorne stehen.',
    a: 'NEON',
    b: 'HIGH_STAKES',
    attractionBps: 240,
    patienceDelta: 2,
    addictionBonus: 2,
  },
  {
    id: 'SYN_NEON_BAR',
    name: 'Neon-Bar',
    description: 'Der Drink ist billig, das Licht teuer. Beides hält sie hier.',
    a: 'NEON',
    b: 'BOOZE',
    attractionBps: 160,
    patienceDelta: 5,
    addictionBonus: 1,
  },
  {
    id: 'SYN_STRASSENKULT',
    name: 'Straßenkult',
    description: 'Klassiker im Scheinwerferlicht. Die alten Automaten werden wieder jung.',
    a: 'CLASSIC',
    b: 'NEON',
    attractionBps: 180,
    patienceDelta: 1,
    addictionBonus: 1,
  },
];

export function synergiesOf(mods: readonly ModId[]): readonly Synergy[] {
  const counts = new Map<OfferTag, number>();
  for (const id of mods) {
    const tag = getMod(id).tag;
    counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return SYNERGIES.filter((synergy) => synergy.a === synergy.b
    ? (counts.get(synergy.a) ?? 0) >= 2
    : (counts.get(synergy.a) ?? 0) > 0 && (counts.get(synergy.b) ?? 0) > 0);
}

function totalOf(mods: readonly ModId[], key: 'attractionBps' | 'patienceDelta' | 'addictionBonus'): number {
  return synergiesOf(mods).reduce((sum, synergy) => sum + synergy[key], 0);
}

export function synergyAttractionOf(mods: readonly ModId[]): number {
  return totalOf(mods, 'attractionBps');
}

export function synergyPatienceOf(mods: readonly ModId[]): number {
  return totalOf(mods, 'patienceDelta');
}

export function synergyAddictionOf(mods: readonly ModId[]): number {
  return totalOf(mods, 'addictionBonus');
}
