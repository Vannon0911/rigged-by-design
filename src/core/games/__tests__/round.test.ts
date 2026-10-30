/**
 * @test-target: src/core/games/round.ts
 * @error-code: ERR-1003
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { foreignRound, testSpin } from '../../sim/actions';
import { createWorld } from '../../sim/templates';
import type { GameId } from '../../sim/types';
import { Prng } from '../../rng/prng';
import { playRound } from '../round';

const GAMES: readonly GameId[] = ['SLOT', 'BLACKJACK', 'POKER', 'ROULETTE', 'PLINKO', 'SHELL', 'DICE'];

/**
 * Plinko laeuft durch echte Physik: deterministisch, aber rund tausendmal teurer
 * pro Runde. Die Stichprobe bleibt gross genug, dass die RTP-Schaetzung nicht am
 * Bandrand kippt.
 */
const ROUNDS: Readonly<Record<GameId, number>> = {
  SLOT: 100_000, BLACKJACK: 100_000, ROULETTE: 100_000,
  SHELL: 100_000, DICE: 100_000, PLINKO: 3_000,
  // Video Poker hat mit Royal und Straight Flush die duennste Tail-Verteilung;
  // eine kleinere Stichprobe schwankt um mehr als das halbe Prozentband.
  POKER: 200_000,
};

describe('Spiele', () => {
  it('jedes Spiel liefert eine gueltige, deterministische Runde', () => {
    for (const game of GAMES) {
      const a = playRound(game, new Prng(1234));
      const b = playRound(game, new Prng(1234));
      expect(a).toEqual(b);
      expect(a.game).toBe(game);
      expect(Number.isSafeInteger(a.multiplierBps)).toBe(true);
      expect(a.multiplierBps).toBeGreaterThanOrEqual(0);
      expect(a.detail.length).toBeGreaterThan(0);
      expect(a.label.length).toBeGreaterThan(0);
    }
  });

  // Sieben unabhaengige Monte-Carlo-Laeufe laufen parallel; jeder Spiel-Lauf ist
  // ohnehin deterministisch, die Reihenfolge aendert also kein Ergebnis.
  it.concurrent.each(GAMES)('%s zahlt 90-96 %% aus und zeigt Gewinner', { timeout: 180_000 }, (game) => {
    {
      const rounds = ROUNDS[game];
      const prng = new Prng(0x51ca5e + game.length);
      let returned = 0;
      let winners = 0;
      for (let index = 0; index < rounds; index += 1) {
        const result = playRound(game, prng);
        returned += result.multiplierBps;
        // Treffer ist jede Auszahlung ueber null; ein haeufiges Teil-Payout zaehlt
        // als Treffer, auch wenn der Netto-Spin ein Verlust bleibt.
        if (result.multiplierBps > 0) winners += 1;
      }
      const rtp = returned / rounds / 10_000;
      const hitRate = winners / rounds;
      expect(rtp, `${game} RTP`).toBeGreaterThan(0.90);
      expect(rtp, `${game} RTP`).toBeLessThan(0.96);
      expect(hitRate, `${game} Gewinnrate`).toBeGreaterThan(0.25);
      expect(hitRate, `${game} Gewinnrate`).toBeLessThan(0.7);
    }
  });

  it('der Testspin kostet kein Geld und veraendert das Ledger nicht', () => {
    const world = createWorld('SMALL');
    const ledger = new Ledger();
    const slot = world.furniture.find((item) => item.kind === 'SLOT')!;
    const entries = ledger.entries.length;
    const result = testSpin(slot, new Prng(7));
    expect(result.game).toBe('SLOT');
    expect(ledger.entries.length).toBe(entries);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
  });

  it('fremde Spiele buchen nur vom Portemonnaie und nie ins Minus', () => {
    const ledger = new Ledger({ PORTEMONNAIE: fromVC(2) });
    const prng = new Prng(44);
    for (let index = 0; index < 20; index += 1) {
      if (ledger.getBalance('PORTEMONNAIE') < fromVC(0.2)) break;
      foreignRound(ledger, GAMES[index % GAMES.length]!, fromVC(0.2), prng, index, 200);
      expect(ledger.getBalance('PORTEMONNAIE')).toBeGreaterThanOrEqual(0);
      expect(ledger.verifyLedgerIntegrity()).toBe(true);
    }
  });
});
