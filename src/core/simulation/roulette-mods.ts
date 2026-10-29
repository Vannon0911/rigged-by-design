/** Kessel-Mods fuer eigene Roulette-Tische: Pockets, Gewichte und Suchtdruck. */
import { fromVC, type VaCoinMicro } from '../economy/vacoin';
import type { ModContract } from '../rng/bias-policy';
import type { OperatorMod, OperatorModId } from './operator-mods';

const contract = (
  id: OperatorModId,
  name: string,
  priceVC: VaCoinMicro,
  minBound: number,
  maxBound: number,
  value: number,
  description: string,
  symbols: readonly string[],
): ModContract => ({
  id,
  name,
  target: 'WEIGHT',
  minBound,
  maxBound,
  costVC: priceVC,
  description,
  value,
  symbols,
});

export const ROULETTE_OPERATOR_MODS: readonly OperatorMod[] = [
  {
    id: 'MOD_ROULETTE_DOUBLE_ZERO',
    name: 'Doppel-Null-Kessel',
    priceVC: fromVC(22),
    description: 'Fuegt eine 00-Tasche hinzu: 38 Pockets, mehr Gruen, mehr Hausvorteil.',
    contracts: [],
    patiencePenalty: 1,
    appliesTo: ['ROULETTE'],
    minVenueTier: 3,
    rouletteDoubleZero: true,
    addictionBonus: 1,
  },
  {
    id: 'MOD_ROULETTE_TRIPLE_ZERO',
    name: 'Dreifach-Null-Kessel',
    priceVC: fromVC(42),
    description: 'Der gruene Schlund: 00 und 000 im Kessel, 39 Pockets und maximaler Hausvorteil.',
    contracts: [],
    patiencePenalty: 2,
    appliesTo: ['ROULETTE'],
    minVenueTier: 3,
    rouletteTripleZero: true,
    addictionBonus: 2,
  },
  {
    id: 'MOD_ROULETTE_MAGNET',
    name: 'Sektor-Elektromagnet',
    priceVC: fromVC(28),
    description: 'Zieht die Kugel in die gruenen Taschen. Das Gewicht bleibt in der Policy-Grenze.',
    contracts: [
      contract(
        'MOD_ROULETTE_MAGNET',
        'Sektor-Elektromagnet',
        fromVC(28),
        1,
        3,
        2.6,
        'Gruene Pockets 2.6x gewichtet',
        ['0', '37', '38'],
      ),
    ],
    patiencePenalty: 2,
    appliesTo: ['ROULETTE'],
    minVenueTier: 3,
    addictionBonus: 3,
  },
  {
    id: 'MOD_ROULETTE_LIGHTNING',
    name: 'Blitz-Taschen-Kessel',
    priceVC: fromVC(52),
    description: 'Einzelzahlen zahlen 29:1, dafuer blinken 1-3 Glueckszahlen mit 100x bis 300x.',
    contracts: [],
    patiencePenalty: 2,
    appliesTo: ['ROULETTE'],
    minVenueTier: 3,
    rouletteLightning: true,
    addictionBonus: 4,
  },
];
