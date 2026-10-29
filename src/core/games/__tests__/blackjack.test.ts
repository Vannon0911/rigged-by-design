import { describe, expect, it } from 'vitest';
import { fromVC } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { Shoe, cardLabel, cardValue, handValue, type Card } from '../deck-engine';
import { BlackjackTable } from '../blackjack/blackjack-engine';
import { playBlackjackAuto, evaluateBlackjackConfig } from '../blackjack/blackjack-evaluator';
import { DEFAULT_BLACKJACK_CONFIG, applyBlackjackMods, type BlackjackConfig } from '../blackjack/blackjack-types';
import { makeHand } from '../blackjack/blackjack-rules';

const SUITS = { S: 'SPADES', H: 'HEARTS', D: 'DIAMONDS', C: 'CLUBS' } as const;

function card(text: string): Card {
  const suit = SUITS[text.slice(-1) as keyof typeof SUITS]!;
  const label = text.slice(0, -1);
  const rank = label === 'A' ? 14 : label === 'K' ? 13 : label === 'Q' ? 12 : label === 'J' ? 11 : Number(label);
  return { rank, suit };
}

function hand(text: string): Card[] {
  return text.split(' ').map(card);
}

function signature(round: ReturnType<typeof playBlackjackAuto>): string {
  return [
    round.playerCards.map(cardLabel).join(','),
    round.dealerCards.map(cardLabel).join(','),
    round.playerTotal,
    round.dealerTotal,
    round.outcome,
    round.payout,
  ].join('|');
}

describe('Kartenstiefel', () => {
  it('mischt deterministisch und respektiert Deck-Mods exakt', () => {
    const left = new Shoe(new Prng(1337), 6);
    const right = new Shoe(new Prng(1337), 6);
    expect(left.remaining).toBe(312);
    expect(left.majors).toBe(120);
    for (let index = 0; index < 40; index += 1) {
      expect(cardLabel(left.draw())).toBe(cardLabel(right.draw()));
    }
    expect(new Shoe(new Prng(1), 6, ['DECK_GREEDY_TENS']).remaining).toBe(300);
    expect(new Shoe(new Prng(1), 6, ['DECK_FAT_FIVES']).remaining).toBe(324);
  });

  it('wertet Asse als 1 oder 11 und deckt den Dealer-Draw ab', () => {
    expect(handValue(hand('AS 9H'))).toBe(20);
    expect(handValue(hand('AS AH 9D'))).toBe(21);
    expect(handValue(hand('AS AH AD'))).toBe(13);
    expect(handValue(hand('KS QD 5C'))).toBe(25);
    expect(makeHand(hand('AS AH 9D')).soft).toBe(true);
    expect(cardValue(card('AS'))).toBe(11);

    const plain = new Shoe(new Prng(77), 6);
    const biased = new Shoe(new Prng(77), 6);
    const total = (base: number, drawn: Card): number => {
      const raw = base + cardValue(drawn);
      return raw > 21 && drawn.rank === 14 ? raw - 10 : raw;
    };
    let plainBusts = 0;
    let biasedBusts = 0;
    for (let index = 0; index < 2_000; index += 1) {
      if (total(16, biased.drawWithBias(16, 2)) > 21) biasedBusts += 1;
      if (total(16, plain.draw()) > 21) plainBusts += 1;
    }
    expect(biasedBusts).toBeLessThan(plainBusts);
  });
});

describe('Blackjack', () => {
  it('gleicher Seed liefert Bit-identische Runden', () => {
    const left = new Prng(4242);
    const right = new Prng(4242);
    for (let round = 0; round < 200; round += 1) {
      expect(signature(playBlackjackAuto(DEFAULT_BLACKJACK_CONFIG, left, fromVC(1))))
        .toBe(signature(playBlackjackAuto(DEFAULT_BLACKJACK_CONFIG, right, fromVC(1))));
    }
  });

  it('zahlt Blackjack 3:2 und mit Haus-Mod nur 6:5', () => {
    let natural = false;
    let natural65 = false;
    const normal = new Prng(777);
    const greedy = new Prng(777);
    const sixFive: BlackjackConfig = applyBlackjackMods(DEFAULT_BLACKJACK_CONFIG, ['BJ_SIX_FIVE_BONUS']);
    for (let round = 0; round < 4_000 && (!natural || !natural65); round += 1) {
      const a = playBlackjackAuto(DEFAULT_BLACKJACK_CONFIG, normal, fromVC(1));
      if (!natural && a.playerBlackjack && !a.dealerBlackjack) {
        natural = true;
        expect(a.payout).toBe(fromVC(2.5));
      }
      const b = playBlackjackAuto(sixFive, greedy, fromVC(1));
      if (!natural65 && b.playerBlackjack && !b.dealerBlackjack) {
        natural65 = true;
        expect(b.payout).toBe(fromVC(2.2));
      }
    }
    expect(natural && natural65).toBe(true);
  });

  it('erlaubt Hit, Stand und Double auf dem echten Tisch', () => {
    const table = new BlackjackTable(DEFAULT_BLACKJACK_CONFIG, new Prng(5));
    let state = table.deal(fromVC(1));
    for (let attempts = 0; state.phase !== 'PLAYER' && attempts < 20; attempts += 1) {
      state = table.deal(fromVC(1));
    }
    expect(state.phase).toBe('PLAYER');
    const afterHit = table.hit();
    expect(afterHit.hits).toBe(1);
    if (afterHit.phase === 'PLAYER') expect(table.stand().phase).toBe('SETTLED');
    else expect(afterHit.outcome).not.toBeNull();

    const doubleTable = new BlackjackTable(DEFAULT_BLACKJACK_CONFIG, new Prng(9));
    let doubleState = doubleTable.deal(fromVC(1));
    for (let attempts = 0; doubleState.phase !== 'PLAYER' && attempts < 20; attempts += 1) {
      doubleState = doubleTable.deal(fromVC(1));
    }
    const doubled = doubleTable.double();
    expect(doubled.totalBet).toBe(fromVC(2));
    expect(doubled.phase).toBe('SETTLED');
  });

  it('Dealer-Push bei 22 und gezinkte Zehner senken den RTP messbar', () => {
    const clean = evaluateBlackjackConfig(DEFAULT_BLACKJACK_CONFIG, 20_000, 13);
    const rigged = evaluateBlackjackConfig(
      applyBlackjackMods(DEFAULT_BLACKJACK_CONFIG, ['BJ_DEALER_PUSH_22', 'BJ_GREEDY_TENS', 'BJ_BIASED_DEALER']),
      20_000,
      13,
    );
    expect(clean.measuredRTP).toBeGreaterThan(0.9);
    expect(rigged.measuredRTP).toBeLessThan(clean.measuredRTP - 0.1);
    expect(rigged.pushRate).toBeGreaterThan(clean.pushRate);
    expect(rigged.houseEdge).toBeGreaterThan(clean.houseEdge + 0.1);

    let pushed22 = 0;
    const prng = new Prng(19);
    for (let round = 0; round < 4_000; round += 1) {
      const result = playBlackjackAuto(
        applyBlackjackMods(DEFAULT_BLACKJACK_CONFIG, ['BJ_DEALER_PUSH_22']),
        prng,
        fromVC(1),
      );
      if (result.dealerPush22Applied) pushed22 += 1;
    }
    expect(pushed22).toBeGreaterThan(0);
  });
});
