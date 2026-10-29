/** Betreiber-Mods: nur fuer eigene Spiele. Nie auf Spieler- oder Besucher-Mods anwenden. */
import { fromVC, type VaCoinMicro } from '../economy/vacoin';
import type { ModContract } from '../rng/bias-policy';
import type { DeckModId } from '../games/cards/card-shoe';
import { ROULETTE_OPERATOR_MODS } from './roulette-mods';

export type OperatorModId =
  | 'MOD_LDW_GEAR'
  | 'MOD_NEAR_MISS'
  | 'MOD_EXTRA_LINE'
  | 'MOD_LEAD_WEIGHT'
  | 'MOD_EXTRA_REEL'
  | 'MOD_DEATH_CARD'
  | 'MOD_SIX_CARD_POKER'
  | 'MOD_ROULETTE_DOUBLE_ZERO'
  | 'MOD_ROULETTE_TRIPLE_ZERO'
  | 'MOD_ROULETTE_MAGNET'
  | 'MOD_ROULETTE_LIGHTNING';

export type OperatorTarget = 'SLOT' | 'SHELL' | 'DICE' | 'ROULETTE' | 'BLACKJACK' | 'POKER';

export interface OperatorMod {
  readonly id: OperatorModId;
  readonly name: string;
  readonly priceVC: VaCoinMicro;
  readonly description: string;
  readonly contracts: readonly ModContract[];
  readonly patiencePenalty: number;
  /** Nur diese Spielarten duerfen den Mod einbauen. */
  readonly appliesTo: readonly OperatorTarget[];
  readonly minVenueTier: 1 | 2 | 3 | 4;
  readonly deckMods?: readonly DeckModId[];
  readonly pokerSixCard?: boolean;
  readonly rouletteDoubleZero?: boolean;
  readonly rouletteTripleZero?: boolean;
  readonly rouletteLightning?: boolean;
  /** Zusaetzlicher Suchtdruck je Besucher-Runde an diesem Geraet. */
  readonly addictionBonus?: number;
}

const slotContract = (id: OperatorModId, name: string, priceVC: VaCoinMicro, target: 'WEIGHT' | 'NEAR_MISS' | 'PAYLINES' | 'REELS', minBound: number, maxBound: number, value: number, description: string, symbols?: readonly string[]): ModContract => ({
  id,
  name,
  target,
  minBound,
  maxBound,
  costVC: priceVC,
  description,
  value,
  ...(symbols ? { symbols } : {}),
});

const slotMod = (
  id: OperatorModId,
  name: string,
  priceVC: VaCoinMicro,
  description: string,
  contract: ModContract,
  minVenueTier: 1 | 2 | 3 | 4 = 1,
  patiencePenalty = 0,
): OperatorMod => ({
  id,
  name,
  priceVC,
  description,
  contracts: [contract],
  patiencePenalty,
  appliesTo: ['SLOT'],
  minVenueTier,
});

export const OPERATOR_MODS: readonly OperatorMod[] = [
  slotMod(
    'MOD_LDW_GEAR',
    'Scheingewinn-Getriebe',
    fromVC(12),
    '+Kirschen-Gewicht: Kirschen zahlen 0.5x, hohe Sucht und mehr Hausvorteil.',
    slotContract('MOD_LDW_GEAR', 'Scheingewinn-Getriebe', fromVC(12), 'WEIGHT', 1, 3, 1.6, 'Cherry-Flut', ['CHERRY']),
  ),
  slotMod(
    'MOD_NEAR_MISS',
    'Near-Miss-Magnetbremse',
    fromVC(25),
    'Erzwingt 35 % Near-Misses bei Nieten: massiver Sucht-Boost.',
    slotContract('MOD_NEAR_MISS', 'Near-Miss-Magnetbremse', fromVC(25), 'NEAR_MISS', 0, 0.35, 0.35, '35 % optische Fast-Jackpots'),
  ),
  slotMod(
    'MOD_EXTRA_LINE',
    'Diagonale Zusatzleitungen',
    fromVC(30),
    'Schaltet bis zu +2 Gewinnlinien frei.',
    slotContract('MOD_EXTRA_LINE', 'Diagonale Zusatzleitungen', fromVC(30), 'PAYLINES', 0, 2, 2, '+2 aktive Linien'),
  ),
  slotMod(
    'MOD_LEAD_WEIGHT',
    'Gezinktes Bleigewicht',
    fromVC(20),
    '-40 % Jackpot-Gewicht, mehr Nieten, hoher Hausgewinn - senkt die Geduld.',
    slotContract('MOD_LEAD_WEIGHT', 'Gezinktes Bleigewicht', fromVC(20), 'WEIGHT', 0.1, 1, 0.6, 'Jackpot-Gewicht auf 60 %', ['VACOIN_DIAMOND']),
    1,
    4,
  ),
  slotMod(
    'MOD_EXTRA_REEL',
    'Vierte Walze',
    fromVC(45),
    'Ein zusaetzliches Zahlenband: mehr Kombinationen, mehr Fast-Treffer. Ab Stufe 2.',
    slotContract('MOD_EXTRA_REEL', 'Vierte Walze', fromVC(45), 'REELS', 0, 3, 1, '+1 Rolle (max. 6)'),
    2,
  ),
  {
    id: 'MOD_DEATH_CARD',
    name: 'Totenkopf im Schuh',
    priceVC: fromVC(30),
    description: 'Legale Zusatzkarte im Dealer-Schuh. Mehr Nieten im Blackjack, kein Karten-Duplikat.',
    contracts: [],
    patiencePenalty: 3,
    appliesTo: ['BLACKJACK'],
    minVenueTier: 3,
    deckMods: ['DECK_DEATH_CARD'],
  },
  {
    id: 'MOD_SIX_CARD_POKER',
    name: 'Sechskarten-Deal',
    priceVC: fromVC(38),
    description: 'Poker-Gaeste bekommen 6 Karten und die beste Hand. Mehr Treffer, kleinere Paar-Payouts.',
    contracts: [],
    patiencePenalty: 0,
    appliesTo: ['POKER'],
    minVenueTier: 4,
    pokerSixCard: true,
  },
  ...ROULETTE_OPERATOR_MODS,
];

const MOD_INDEX = new Map(OPERATOR_MODS.map((mod) => [mod.id, mod]));

export function getOperatorMod(id: OperatorModId): OperatorMod {
  const mod = MOD_INDEX.get(id);
  if (!mod) throw new Error(`Unbekannter Betreiber-Mod: ${id}`);
  return mod;
}

export interface RouletteModLoadout {
  readonly mods: readonly ModContract[];
  readonly doubleZero: boolean;
  readonly tripleZero: boolean;
  readonly lightning: boolean;
  readonly addictionBonus: number;
}

/** Uebersetzt installierte Betreiber-Mods in eine echte Roulette-Konfiguration. */
export function rouletteModLoadout(ids: readonly OperatorModId[]): RouletteModLoadout {
  const installed = ids.map((id) => getOperatorMod(id));
  return {
    mods: installed.flatMap((mod) => mod.contracts),
    doubleZero: installed.some((mod) => mod.rouletteDoubleZero === true),
    tripleZero: installed.some((mod) => mod.rouletteTripleZero === true),
    lightning: installed.some((mod) => mod.rouletteLightning === true),
    addictionBonus: installed.reduce((sum, mod) => sum + (mod.addictionBonus ?? 0), 0),
  };
}

export function operatorModsFor(kind: OperatorTarget, venueTier: number): readonly OperatorMod[] {
  return OPERATOR_MODS.filter((mod) => mod.appliesTo.includes(kind) && mod.minVenueTier <= venueTier);
}
