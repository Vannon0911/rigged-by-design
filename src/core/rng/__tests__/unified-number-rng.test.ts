import { describe, expect, it } from 'vitest';
import { fromVC } from '../../economy/vacoin';
import { DEFAULT_DICE_CONFIG, playDiceRound } from '../../games/dice/dice-engine';
import { DEFAULT_ROULETTE_CONFIG, playRouletteRound } from '../../games/roulette/roulette-engine';
import { DEFAULT_SHELL_CONFIG, playShellRound } from '../../games/shell/shell-engine';
import {
  CardShoe,
  verifyShoeIntegrity,
  type Card,
} from '../../games/cards/card-shoe';
import { DEFAULT_BLACKJACK_CONFIG, playBlackjackAuto } from '../../games/cards/blackjack-engine';
import { DEFAULT_POKER_CONFIG, playPokerRound } from '../../games/cards/poker-engine';
import { resolvePaylines, spinSlot } from '../../slot/slot-engine';
import { SLOT_SYMBOLS, type ReelStrip, type SlotConfig } from '../../slot/slot-types';
import { Prng } from '../prng';
import {
  NUMBER_LIMITS,
  getNumberRollCount,
  resetNumberRollStats,
  rollNumber,
} from '../number-rng';

const STRIP = Array.from({ length: 20 }, (_, index) => SLOT_SYMBOLS[index % SLOT_SYMBOLS.length]!);

function reels(count: number, riggedReel = -1): readonly ReelStrip[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `reel-${index + 1}`,
    symbols: index === riggedReel ? ['VACOIN_DIAMOND', ...Array(19).fill('BLANK') as string[]] as never : STRIP,
    manipulation: index === riggedReel ? { targetNumbers: [0], pullStrength: 1 } : undefined,
  }));
}

function slotConfig(reelCount: number, riggedReel = -1): SlotConfig {
  return {
    id: `dynamic-${reelCount}`,
    baseBet: fromVC(0.5),
    reels: reels(reelCount, riggedReel),
    paylines: Math.min(9, reelCount + 2),
    mods: [],
  };
}

function sequence(reelCount: number): string {
  const prng = new Prng(20261029);
  return JSON.stringify(Array.from({ length: 60 }, () => spinSlot(slotConfig(reelCount), prng, 10_000)));
}

describe('Universelles Zahlen-RNG', () => {
  it('klemmt Pull und Fenster auf die Systemgrenzen', () => {
    const result = rollNumber(
      0,
      36,
      { targetNumbers: [17, 99], pullStrength: 99, windowShift: 99 },
      new Prng(7),
    );
    expect(result.finalNumber).toBeGreaterThanOrEqual(0);
    expect(result.finalNumber).toBeLessThanOrEqual(36);
    expect(result.theoreticalHitChance).toBeCloseTo(1 / 37, 10);
    expect(result.realHitChance).toBeLessThanOrEqual(1);
    expect(NUMBER_LIMITS.maxPullStrength).toBe(1);
    expect(NUMBER_LIMITS.maxWindowShift).toBe(0.5);
  });

  it('positiver Pull zieht messbar auf Zielzahlen, negativer Pull drueckt weg', () => {
    const positive = new Prng(11);
    const negative = new Prng(11);
    let positiveHits = 0;
    let negativeHits = 0;
    for (let index = 0; index < 4_000; index += 1) {
      if (rollNumber(0, 36, { targetNumbers: [17], pullStrength: 0.8 }, positive).finalNumber === 17) {
        positiveHits += 1;
      }
      if (rollNumber(0, 36, { targetNumbers: [17], pullStrength: -0.8 }, negative).finalNumber === 17) {
        negativeHits += 1;
      }
    }
    expect(positiveHits / 4_000).toBeGreaterThan(0.55);
    expect(negativeHits / 4_000).toBeLessThan(0.02);
  });

  it('windowShift verschiebt nur innerhalb des Zahlenbereichs', () => {
    const prng = new Prng(1234);
    let total = 0;
    for (let index = 0; index < 2_000; index += 1) {
      total += rollNumber(0, 100, { windowShift: 0.5 }, prng).finalNumber;
    }
    expect(total / 2_000).toBeGreaterThan(55);
  });
});

describe('Alle fuenf Spiel-Familien nutzen rollNumber', () => {
  it('Slot, Hütchen, Würfel, Roulette, Blackjack und Poker erzeugen Zahlen-Rolls', () => {
    resetNumberRollStats();
    const prng = new Prng(4242);

    const slotBefore = getNumberRollCount();
    const spin = spinSlot(slotConfig(5), prng, 10_000);
    expect(spin.grid).toHaveLength(5);
    expect(getNumberRollCount()).toBeGreaterThan(slotBefore);

    const shellBefore = getNumberRollCount();
    const shell = playShellRound({ ...DEFAULT_SHELL_CONFIG, manipulation: { targetNumbers: [0], pullStrength: 1 } }, prng, fromVC(1));
    expect(shell.winning).toContain(0);
    expect(getNumberRollCount()).toBeGreaterThan(shellBefore);

    const diceBefore = getNumberRollCount();
    const dice = playDiceRound({ ...DEFAULT_DICE_CONFIG, diceCount: 3, manipulation: { targetNumbers: [6], pullStrength: 1 } }, prng, fromVC(1));
    expect(dice.dice.every((face) => face === 6)).toBe(true);
    expect(getNumberRollCount()).toBeGreaterThan(diceBefore);

    const rouletteBefore = getNumberRollCount();
    const roulette = playRouletteRound(
      { ...DEFAULT_ROULETTE_CONFIG, bet: 'STRAIGHT', straightNumber: 17, manipulation: { targetNumbers: [17], pullStrength: 1 } },
      prng,
      fromVC(1),
    );
    expect(roulette.pocket).toBe(17);
    expect(getNumberRollCount()).toBeGreaterThan(rouletteBefore);

    const cardBefore = getNumberRollCount();
    const blackjack = playBlackjackAuto(DEFAULT_BLACKJACK_CONFIG, prng, fromVC(1));
    expect(blackjack.playerCards.length).toBeGreaterThan(0);
    expect(getNumberRollCount()).toBeGreaterThan(cardBefore);

    const pokerBefore = getNumberRollCount();
    const poker = playPokerRound(DEFAULT_POKER_CONFIG, prng, fromVC(1));
    expect(poker.playerCards).toHaveLength(5);
    expect(getNumberRollCount()).toBeGreaterThan(pokerBefore);
  });

  it('3 bis 6 Rollen sind deterministisch und 1 bis 9 Linien bleiben endlich', () => {
    for (const count of [3, 4, 5, 6] as const) {
      expect(sequence(count)).toBe(sequence(count));
      const result = spinSlot(slotConfig(count), new Prng(9), 10_000);
      expect(result.grid).toHaveLength(count);
      expect(result.grid.every((column) => column.length === 3)).toBe(true);
      expect(result.totalBet).toBe(fromVC(0.5) * Math.min(9, count + 2));
      expect(resolvePaylines({ ...slotConfig(count), paylines: 9 })).toHaveLength(9);
    }
  });

  it('eine manipulierte Rolle zieht innerhalb ihres Zahlenbands auf das Ziel', () => {
    const result = spinSlot(slotConfig(5, 3), new Prng(77), 10_000);
    expect(result.grid[3]![0]).toBe('VACOIN_DIAMOND');
    expect(result.grid[3]).toHaveLength(3);
    expect(result.grid[0]!.length).toBe(3);
  });
});

describe('Kartenstiefel mit Zusatzkarten', () => {
  it('fuegt Extra-Karten legal hinzu und bleibt ohne Zuruecklegen integer', () => {
    const extra: Card = { rank: 14, suit: 'SPADES', id: 'extra-ace' };
    const shoe = new CardShoe(new Prng(99), 1, [], [extra]);
    expect(shoe.initialDeckSize).toBe(53);
    for (let index = 0; index < 20; index += 1) {
      expect(shoe.draw()).toBeTruthy();
      expect(verifyShoeIntegrity(shoe)).toBe(true);
    }
    expect(new Set(shoe.drawnCards.map((card) => card.id)).size).toBe(20);
  });
});
