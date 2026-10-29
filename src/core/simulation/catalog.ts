/** Baumarkt-Katalog: Bauobjekte und Spielstaetten mit festen Preisen in Mikro-VC. */
import { ZERO_VC, fromVC, type VaCoinMicro } from '../economy/vacoin';

export type BuildableId =
  | 'SHELL_CART'
  | 'SLOT_RUSTY'
  | 'DICE_TABLE'
  | 'SLOT_NEON'
  | 'DECO_CARPET'
  | 'DECO_NEON_SIGN'
  | 'DECO_BOOZE';
export type BuildableKind = 'SLOT' | 'SHELL' | 'DICE' | 'DECO';

export interface BuildableItem {
  readonly id: BuildableId;
  readonly kind: BuildableKind;
  readonly name: string;
  readonly priceVC: VaCoinMicro;
  readonly description: string;
  readonly paylines: 1 | 3;
  readonly maxMods: number;
  readonly attractionBps: number;
  readonly patienceLossReductionBps: number;
  readonly spawnBonusBps: number;
  readonly startingAddiction: number;
  readonly boozePatience: number;
  readonly operatingCostVC: VaCoinMicro;
  readonly minBetVC: VaCoinMicro;
  readonly maxBetVC: VaCoinMicro;
}

const BASE = {
  kind: 'DECO' as const,
  paylines: 1 as const,
  maxMods: 0,
  attractionBps: 0,
  patienceLossReductionBps: 0,
  spawnBonusBps: 0,
  startingAddiction: 0,
  boozePatience: 0,
  operatingCostVC: ZERO_VC,
  minBetVC: ZERO_VC,
  maxBetVC: ZERO_VC,
};

export const BUILDABLES: readonly BuildableItem[] = [
  {
    ...BASE,
    id: 'SHELL_CART',
    kind: 'SHELL',
    name: 'Hütchenspieler-Karton',
    priceVC: fromVC(5),
    description: '3 Becher, 1 Kugel, 2.8x Auszahlung. Das billigste Startgeschäft im Hinterhof.',
    attractionBps: 800,
    minBetVC: fromVC(0.05),
    maxBetVC: fromVC(0.5),
  },
  {
    ...BASE,
    id: 'SLOT_RUSTY',
    kind: 'SLOT',
    name: 'Rostiger 3-Walzen-Slot',
    priceVC: fromVC(15),
    description: '1 Payline, maximal 2 Mods.',
    maxMods: 2,
    minBetVC: fromVC(0.05),
    maxBetVC: fromVC(0.25),
  },
  {
    ...BASE,
    id: 'DICE_TABLE',
    kind: 'DICE',
    name: 'Hinterhof-Würfeltisch',
    priceVC: fromVC(28),
    description: 'Street Craps mit 2 Würfeln: Over/Under und Lucky 7. Die Brücke zum großen Casino.',
    attractionBps: 900,
    minBetVC: fromVC(0.1),
    maxBetVC: fromVC(2),
  },
  {
    ...BASE,
    id: 'SLOT_NEON',
    kind: 'SLOT',
    name: 'Neon-Kabinett Mk. II',
    priceVC: fromVC(65),
    description: '3 Paylines, maximal 4 Mods, +15 % Anziehung.',
    paylines: 3,
    maxMods: 4,
    attractionBps: 1500,
    minBetVC: fromVC(0.1),
    maxBetVC: fromVC(0.5),
  },
  {
    ...BASE,
    id: 'DECO_CARPET',
    name: 'Abgetretener Roter Teppich',
    priceVC: fromVC(8),
    description: '-20 % Geduldsverlust aller Besucher.',
    patienceLossReductionBps: 2000,
  },
  {
    ...BASE,
    id: 'DECO_NEON_SIGN',
    name: 'Neon-Reklameschild',
    priceVC: fromVC(18),
    description: '+25 % Besucher-Spawnrate, +5 Start-Sucht.',
    spawnBonusBps: 2500,
    startingAddiction: 5,
  },
  {
    ...BASE,
    id: 'DECO_BOOZE',
    name: 'Freier Fusel-Spender',
    priceVC: fromVC(32),
    description: 'Gibt Besuchern einmalig +20 Geduld fuer 0.0500 VC Betriebskosten.',
    boozePatience: 20,
    operatingCostVC: fromVC(0.05),
  },
];

const BUILDABLE_INDEX = new Map(BUILDABLES.map((item) => [item.id, item]));

export function getBuildable(id: BuildableId): BuildableItem {
  const item = BUILDABLE_INDEX.get(id);
  if (!item) throw new Error(`Unbekanntes Bauobjekt: ${id}`);
  return item;
}

export {
  OPERATOR_MODS,
  getOperatorMod,
  type OperatorMod,
  type OperatorModId,
} from './operator-mods';
