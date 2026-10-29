/** Spielt eine echte Tisch-Runde im CPU-Casino: Einsatz buchen, Ergebnis, Gewinn zurueckbuchen. */
import type { Ledger, LedgerEntry } from '../economy/ledger';
import { mulVC, toVCString, ZERO_VC, type VaCoinMicro } from '../economy/vacoin';
import { playBlackjackAuto } from '../games/blackjack/blackjack-evaluator';
import { DEFAULT_BLACKJACK_CONFIG, applyBlackjackMods, type BlackjackRound } from '../games/blackjack/blackjack-types';
import { playPokerRound } from '../games/poker/poker-engine';
import { DEFAULT_POKER_CONFIG, resolvePokerConfig, type PokerRound } from '../games/poker/poker-types';
import { playRouletteRound } from '../games/roulette/roulette-engine';
import { DEFAULT_ROULETTE_CONFIG, type RouletteBetType, type RouletteRound } from '../games/roulette/roulette-types';
import type { Prng } from '../rng/prng';
import { getCpuCasino, type CpuCasinoId } from './cpu-casinos';
import { TABLE_GAME_NAMES, getCpuTableOffer, type CpuTableGame } from './cpu-tables';

export interface CpuTableResult {
  readonly casinoId: CpuCasinoId;
  readonly game: CpuTableGame;
  readonly totalBet: VaCoinMicro;
  readonly payout: VaCoinMicro;
  readonly label: string;
  readonly roulette: RouletteRound | null;
  readonly blackjack: BlackjackRound | null;
  readonly poker: PokerRound | null;
  readonly betEntry: LedgerEntry;
  readonly payoutEntry: LedgerEntry | null;
}

export interface CpuTableOptions {
  readonly rouletteBet?: RouletteBetType;
  readonly straightNumber?: number;
  readonly rouletteDozen?: 1 | 2 | 3;
  /** Nur Player-Mods: Auszahlungsbonus in Basispunkten. */
  readonly payoutBonusBps?: number;
  /** Nur Player-Mods: heimlicher Kartenvorteil (zusaetzliches Ass im Schuh). */
  readonly playerCardBonus?: boolean;
}

export function playCpuTableRound(
  casinoId: CpuCasinoId,
  game: CpuTableGame,
  bet: VaCoinMicro,
  ledger: Ledger,
  prng: Prng,
  tick: number,
  options: CpuTableOptions = {},
): CpuTableResult {
  const casino = getCpuCasino(casinoId);
  const offer = getCpuTableOffer(casinoId, game);
  if (!Number.isSafeInteger(bet) || bet <= 0) throw new Error('playCpuTableRound: Einsatz muss > 0 sein');
  if (bet < offer.minBetVC || bet > offer.maxBetVC) {
    throw new Error(`${TABLE_GAME_NAMES[game]} in ${casino.name}: Einsatz ${toVCString(bet)} ausserhalb des Limits`);
  }
  const betEntry = ledger.transfer('PLAYER_CASH', 'CPU_CASINO_POOL', bet, `cpu ${game.toLowerCase()} ${casinoId}`, tick);
  let payout = ZERO_VC;
  let label = '';
  let roulette: RouletteRound | null = null;
  let blackjack: BlackjackRound | null = null;
  let poker: PokerRound | null = null;

  if (game === 'ROULETTE') {
    const highLimit = casinoId === 'CPU_HIGH_ROLLER';
    roulette = playRouletteRound(
      {
        ...DEFAULT_ROULETTE_CONFIG,
        id: `cpu-${casinoId}-roulette`,
        bet: options.rouletteBet ?? 'RED',
        straightNumber: options.straightNumber ?? 17,
        dozen: options.rouletteDozen ?? 1,
        doubleZero: highLimit,
        tripleZero: highLimit,
        lightning: highLimit,
      },
      prng,
      bet,
    );
    payout = roulette.payout;
    const lightning = roulette.lightningMultiplierBps
      ? ` BLITZ ${(roulette.lightningMultiplierBps / 10_000).toFixed(0)}x`
      : '';
    label = roulette.win
      ? `${roulette.pocketLabel} ${roulette.color}${lightning} - ${toVCString(payout)} zurueck.`
      : `${roulette.pocketLabel} ${roulette.color} - Einsatz weg.`;
  } else if (game === 'BLACKJACK') {
    const houseMods = casinoId === 'CPU_HIGH_ROLLER'
      ? (['BJ_SIX_FIVE_BONUS', ...(options.playerCardBonus ? ['BJ_FIFTH_ACE' as const] : [])] as const)
      : (options.playerCardBonus ? (['BJ_FIFTH_ACE'] as const) : ([] as const));
    blackjack = playBlackjackAuto(
      applyBlackjackMods({ ...DEFAULT_BLACKJACK_CONFIG, id: `cpu-${casinoId}-blackjack` }, houseMods),
      prng,
      bet,
      ZERO_VC,
      false,
    );
    payout = blackjack.payout;
    label = blackjack.playerBlackjack
      ? 'BLACKJACK!'
      : blackjack.outcome === 'PLAYER_WIN' || blackjack.outcome === 'DEALER_BUST'
        ? `Hand gewinnt: ${toVCString(payout)}.`
        : blackjack.outcome === 'PUSH' || blackjack.outcome === 'PUSH_22'
          ? 'Push - Einsatz zurueck.'
          : `Dealer gewinnt (${blackjack.dealerTotal} gegen ${blackjack.playerTotal}).`;
  } else {
    const houseMods = casinoId === 'CPU_HIGH_ROLLER' ? (['POKER_SIX_CARD_DEAL'] as const) : ([] as const);
    poker = playPokerRound(
      resolvePokerConfig({ ...DEFAULT_POKER_CONFIG, id: `cpu-${casinoId}-poker`, ante: bet }, houseMods),
      prng,
      bet,
    );
    payout = poker.payout;
    label = `${poker.playerRank.categoryName} gegen ${poker.dealerRank.categoryName}: ${
      poker.outcome === 'PLAYER_WIN' ? `+${toVCString(payout)}` : poker.outcome === 'DEALER_WIN' ? 'verloren' : 'Push'
    }`;
  }

  const bonusBps = Math.max(0, options.payoutBonusBps ?? 0);
  const finalPayout = payout > ZERO_VC ? mulVC(payout, 10_000 + bonusBps) : ZERO_VC;
  const payoutEntry = finalPayout > ZERO_VC
    ? ledger.transfer('CPU_CASINO_POOL', 'PLAYER_CASH', finalPayout, `cpu table win ${casinoId}`, tick)
    : null;
  const boostedLabel = finalPayout > payout ? `${label} (+${(bonusBps / 100).toFixed(0)}% Player-Mod)` : label;
  return { casinoId, game, totalBet: bet, payout: finalPayout, label: boostedLabel, roulette, blackjack, poker, betEntry, payoutEntry };
}
