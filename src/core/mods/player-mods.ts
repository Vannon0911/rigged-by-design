/** Player-Mods: strikt PLAYER_ONLY. Betreiber-Mods (OPERATOR_ONLY) duerfen hier nie einfliessen. */
import { BPS_DENOMINATOR, fromVC, type VaCoinMicro } from '../economy/vacoin';

export type PlayerModId =
  | 'PMOD_LOADED_DICE'
  | 'PMOD_SLEEVE_HOLD'
  | 'PMOD_XRAY_SHADES'
  | 'PMOD_LUCKY_FANG'
  | 'PMOD_BRIBE_RING';

export type ModScope = 'PLAYER_ONLY' | 'OPERATOR_ONLY';
export type CosmeticLayer = 'BODY' | 'FACE' | 'HEAD' | 'HAND' | 'NECK';

export interface ModCosmetic {
  readonly layer: CosmeticLayer;
  readonly partId: string;
  readonly label: string;
  readonly tint: number;
}

export interface ModEffectSpec {
  readonly diceShiftBps?: number;
  readonly cardLookahead?: number;
  readonly shellRevealBps?: number;
  readonly mediumWeightBonusBps?: number;
  readonly luckBiasBps?: number;
  readonly payoutBonusBps?: number;
  readonly suspicionReductionBps?: number;
}

export interface PlayerMod {
  readonly id: PlayerModId;
  readonly name: string;
  readonly priceVC: VaCoinMicro;
  readonly description: string;
  readonly scope: 'PLAYER_ONLY';
  readonly suspicionPerUse: number;
  readonly cosmetic: ModCosmetic;
  readonly effects: ModEffectSpec;
}

export const PLAYER_MODS: readonly PlayerMod[] = [
  {
    id: 'PMOD_LOADED_DICE',
    name: 'Gezinkte Knochenwuerfel',
    priceVC: fromVC(18),
    description: 'Verschiebt eigene Wuerfelwuerfe um +15 % Richtung 6. +4 Suspicion pro Wurf.',
    scope: 'PLAYER_ONLY',
    suspicionPerUse: 4,
    cosmetic: { layer: 'HAND', partId: 'LOADED_DIE', label: 'Leuchtender Wuerfel in der Hand', tint: 0x6cf7a8 },
    effects: { diceShiftBps: 1500 },
  },
  {
    id: 'PMOD_SLEEVE_HOLD',
    name: 'Feder-Aermelhalter',
    priceVC: fromVC(35),
    description: 'Blackjack/Poker im CPU-Casino: 1x pro Schuh heimlich Karte tauschen (Lookahead +1). +12 Suspicion.',
    scope: 'PLAYER_ONLY',
    suspicionPerUse: 12,
    cosmetic: { layer: 'HAND', partId: 'SLEEVE_BRACE', label: 'Mechanische Armschiene', tint: 0x9aa7c7 },
    effects: { cardLookahead: 1 },
  },
  {
    id: 'PMOD_XRAY_SHADES',
    name: 'Roentgen-Visor',
    priceVC: fromVC(50),
    description: 'Huetchenspiel: 40 % Schatten-Reveal. CPU-Slots: +8 % Gewicht auf mittlere Gewinnsymbole. +6 Suspicion.',
    scope: 'PLAYER_ONLY',
    suspicionPerUse: 6,
    cosmetic: { layer: 'FACE', partId: 'XRAY_VISOR', label: 'Cyber-Brille mit rotem Visier', tint: 0xff4d4d },
    effects: { shellRevealBps: 4000, mediumWeightBonusBps: 800 },
  },
  {
    id: 'PMOD_LUCKY_FANG',
    name: 'Vergoldeter Ratten-Talisman',
    priceVC: fromVC(14),
    description: 'Legal, +0 Suspicion. Nach 4 Nieten in Folge steigt der Luck-Bias des naechsten Spins um +25 %.',
    scope: 'PLAYER_ONLY',
    suspicionPerUse: 0,
    cosmetic: { layer: 'NECK', partId: 'GOLD_CHAIN', label: 'Dicke Goldkette', tint: 0xffd166 },
    effects: { luckBiasBps: 2500 },
  },
  {
    id: 'PMOD_BRIBE_RING',
    name: 'Siegelring des Syndikats',
    priceVC: fromVC(80),
    description: 'Senkt Suspicion aller anderen Player-Mods um 50 % und erhoeht Auszahlungen in CPU-Casinos um +5 %.',
    scope: 'PLAYER_ONLY',
    suspicionPerUse: 0,
    cosmetic: { layer: 'HEAD', partId: 'TOPHAT_CIGAR', label: 'Goldener Zylinder + Zigarre', tint: 0xf0c419 },
    effects: { payoutBonusBps: 500, suspicionReductionBps: 5000 },
  },
];

const MOD_INDEX: ReadonlyMap<PlayerModId, PlayerMod> = new Map(PLAYER_MODS.map((mod) => [mod.id, mod]));

export function getPlayerMod(id: PlayerModId): PlayerMod {
  const mod = MOD_INDEX.get(id);
  if (!mod) throw new Error(`Unbekannte Player-Mod: ${id}`);
  return mod;
}

export function cosmeticsFor(equipped: readonly PlayerModId[]): readonly ModCosmetic[] {
  return equipped.map((id) => getPlayerMod(id).cosmetic);
}

/** Zielgruppe: nur der Spieler selbst sieht Player-Mod-Effekte, Besucher nie. */
export type EffectAudience = 'CPU_CASINO_PLAYER' | 'OWN_CASINO_VISITOR';

export interface ResolvedEffects {
  readonly diceShiftBps: number;
  readonly cardLookahead: number;
  readonly shellRevealBps: number;
  readonly mediumWeightBonusBps: number;
  readonly payoutBonusBps: number;
  readonly luckBiasBps: number;
  readonly suspicionReductionBps: number;
}

export const NEUTRAL_EFFECTS: ResolvedEffects = Object.freeze({
  diceShiftBps: 0,
  cardLookahead: 0,
  shellRevealBps: 0,
  mediumWeightBonusBps: 0,
  payoutBonusBps: 0,
  luckBiasBps: 0,
  suspicionReductionBps: 0,
});

export const BAD_LUCK_STREAK = 4;

export function collectEffects(equipped: readonly PlayerModId[], audience: EffectAudience): ResolvedEffects {
  if (audience !== 'CPU_CASINO_PLAYER') return NEUTRAL_EFFECTS;
  let diceShiftBps = 0;
  let cardLookahead = 0;
  let shellRevealBps = 0;
  let mediumWeightBonusBps = 0;
  let payoutBonusBps = 0;
  let luckBiasBps = 0;
  let suspicionReductionBps = 0;
  for (const id of equipped) {
    const effects = getPlayerMod(id).effects;
    diceShiftBps += effects.diceShiftBps ?? 0;
    cardLookahead += effects.cardLookahead ?? 0;
    shellRevealBps += effects.shellRevealBps ?? 0;
    mediumWeightBonusBps += effects.mediumWeightBonusBps ?? 0;
    payoutBonusBps += effects.payoutBonusBps ?? 0;
    luckBiasBps = Math.max(luckBiasBps, effects.luckBiasBps ?? 0);
    suspicionReductionBps = Math.max(suspicionReductionBps, effects.suspicionReductionBps ?? 0);
  }
  return { diceShiftBps, cardLookahead, shellRevealBps, mediumWeightBonusBps, payoutBonusBps, luckBiasBps, suspicionReductionBps };
}

/** Suspicion pro Einsatz eines Mods, inkl. Syndikats-Rabatt. */
export function suspicionForUse(equipped: readonly PlayerModId[], id: PlayerModId): number {
  const base = getPlayerMod(id).suspicionPerUse;
  if (base === 0) return 0;
  const reduction = collectEffects(equipped, 'CPU_CASINO_PLAYER').suspicionReductionBps;
  return Math.ceil((base * (BPS_DENOMINATOR - reduction)) / BPS_DENOMINATOR);
}

/** Luck-Bias erst nach einer Pechserie; fuer Besucher immer 0. */
export function luckBiasFor(equipped: readonly PlayerModId[], lossStreak: number, audience: EffectAudience): number {
  if (lossStreak < BAD_LUCK_STREAK) return 0;
  return collectEffects(equipped, audience).luckBiasBps;
}
