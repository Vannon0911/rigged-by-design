/**
 * @test-target: src/core/games/round.ts
 * @error-code: ERR-1003
 *
 * Durchsatz-Benchmark der Spielrunden. Bewusst nicht Teil von verify:all:
 * Er misst Geschwindigkeit und darf auf langsamer Hardware nicht rot werden.
 * Eine Operation entspricht ROUNDS Runden eines Spiels mit festem Seed.
 */
import { test } from 'vitest';
import { Prng } from '../../rng/prng';
import type { GameId } from '../../sim/types';
import { playRound } from '../round';

const GAMES: readonly GameId[] = ['SLOT', 'BLACKJACK', 'POKER', 'ROULETTE', 'PLINKO', 'SHELL', 'DICE'];
const SEED = 0x51ca5e;
const ROUNDS = 20_000;

test('Spieldurchsatz je Runde', { timeout: 600_000 }, async ({ bench }) => {
  for (const game of GAMES) {
    const result = await bench(game, () => {
      const prng = new Prng(SEED + game.length);
      for (let index = 0; index < ROUNDS; index += 1) playRound(game, prng);
    }).run();
    console.log(`${game}: ${(result.period / ROUNDS).toFixed(4)} ms/op (${ROUNDS} Runden je Operation)`);
  }
});
