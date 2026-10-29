/** Fremde Casinos: du bist Gast, die Mods des Besitzers gelten, dein Geld ist Einsatz. */
import type { Ledger } from '../economy/ledger';
import { fromVC, ZERO_VC, type VaCoinMicro } from '../economy/vacoin';
import { modContracts, type ModId } from '../offer/mods';
import { getReel, type ReelId } from '../offer/reels';
import type { Prng } from '../rng/prng';
import { resolvePaylines, spinSlot } from '../slot/slot-engine';
import type { SlotConfig, SpinResult } from '../slot/slot-types';
import type { VenueTier } from '../venues';

export type HouseId = 'HOUSE_STREET' | 'HOUSE_BACKROOM' | 'HOUSE_SPIRE' | 'HOUSE_PALACE';

export interface House {
  readonly id: HouseId;
  readonly name: string;
  readonly description: string;
  readonly tier: VenueTier;
  readonly minBetVC: VaCoinMicro;
  readonly reels: readonly ReelId[];
  readonly mods: readonly ModId[];
  readonly paylines: number;
}

export const HOUSES: readonly House[] = [
  {
    id: 'HOUSE_STREET',
    name: 'Straßen-Spelunke',
    description: 'Fairer Automat, ehrliche Nieten. Der Besitzer kennt deinen Namen nicht.',
    tier: 1,
    minBetVC: fromVC(0.1),
    reels: ['REEL_STREET', 'REEL_MIXED', 'REEL_STREET'],
    mods: ['MOD_NEON_FRAME'],
    paylines: 1,
  },
  {
    id: 'HOUSE_BACKROOM',
    name: 'Hinterhof-Club',
    description: 'Drei Linien, Near-Miss-Magnet. Der Besitzer nennt es „Service".',
    tier: 2,
    minBetVC: fromVC(0.25),
    reels: ['REEL_MIXED', 'REEL_CHERRY', 'REEL_MIXED'],
    mods: ['MOD_NEAR_MISS', 'MOD_EXTRA_LINE'],
    paylines: 3,
  },
  {
    id: 'HOUSE_SPIRE',
    name: 'Neon-Spire',
    description: 'Vier Walzen, viel Licht, wenig Geduld. Ab eigener Stufe 3.',
    tier: 3,
    minBetVC: fromVC(0.5),
    reels: ['REEL_SEVEN', 'REEL_MIXED', 'REEL_BELL', 'REEL_CHERRY'],
    mods: ['MOD_NEAR_MISS', 'MOD_CHERRY_FLOOD'],
    paylines: 3,
  },
  {
    id: 'HOUSE_PALACE',
    name: 'Mogul-Lounge',
    description: 'High Roller, House Edge, Samt. Ab eigener Stufe 4.',
    tier: 4,
    minBetVC: fromVC(1),
    reels: ['REEL_SEVEN', 'REEL_DIAMOND', 'REEL_BELL', 'REEL_SEVEN'],
    mods: ['MOD_NEAR_MISS', 'MOD_EXTRA_LINE', 'MOD_EXTRA_REEL'],
    paylines: 3,
  },
];

const HOUSE_INDEX = new Map(HOUSES.map((house) => [house.id, house]));

export function getHouse(id: HouseId): House {
  const house = HOUSE_INDEX.get(id);
  if (!house) throw new Error(`Unbekanntes Haus: ${id}`);
  return house;
}

export function houseConfig(house: House, betPerLine: VaCoinMicro): SlotConfig {
  return {
    id: house.id,
    baseBet: betPerLine,
    paylines: house.paylines,
    reels: house.reels.map((id) => ({ id, symbols: getReel(id).symbols })),
    mods: modContracts(house.mods),
  };
}

export interface HouseSpinResult {
  readonly houseId: HouseId;
  readonly houseName: string;
  readonly totalBet: VaCoinMicro;
  readonly payout: VaCoinMicro;
  readonly spin: SpinResult;
}

/** Kein Spieler-Bonus: die Haus-Mods sind die einzigen Mods. */
export function playHouseSpin(
  houseId: HouseId,
  betPerLine: VaCoinMicro,
  ledger: Ledger,
  prng: Prng,
  tick: number,
): HouseSpinResult {
  const house = getHouse(houseId);
  if (!Number.isSafeInteger(betPerLine) || betPerLine < house.minBetVC) {
    throw new Error(`Mindesteinsatz ${house.minBetVC / 10_000} VC pro Linie.`);
  }
  const config = houseConfig(house, betPerLine);
  const lines = resolvePaylines(config).length;
  const totalBet = (betPerLine * lines) as VaCoinMicro;
  if (ledger.getBalance('PLAYER_CASH') < totalBet) throw new Error('Nicht genug Bargeld für diesen Einsatz.');
  ledger.transfer('PLAYER_CASH', 'EXTERNAL_WORK', totalBet, `visit ${houseId} bet`, tick);
  const spin = spinSlot(config, prng);
  if (spin.totalPayout > ZERO_VC) {
    ledger.transfer('EXTERNAL_WORK', 'PLAYER_CASH', spin.totalPayout, `visit ${houseId} win`, tick);
  }
  return { houseId, houseName: house.name, totalBet, payout: spin.totalPayout, spin };
}

