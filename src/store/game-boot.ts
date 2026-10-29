/** Stellt einen gespeicherten Floor wieder her, ohne den GameStore mit Boot-Details zu ueberladen. */
import type { CasinoFloor } from '../core/simulation/casino-floor';
import type { CpuCasinoId } from '../core/simulation/cpu-casinos';
import { CPU_CASINOS } from '../core/simulation/cpu-casinos';
import type { VaCoinMicro } from '../core/economy/vacoin';
import type { GameSave } from './game-save';

export interface RestoredGame {
  readonly clock: number;
  readonly tick: number;
  readonly casinoId: CpuCasinoId;
  readonly bet: VaCoinMicro;
  readonly notice: string;
}

/** null = beschaedigter Save; der Floor bleibt dann leer und der Spieler startet neu. */
export function restoreSavedGame(saved: GameSave, floor: CasinoFloor): RestoredGame | null {
  try {
    floor.restore(saved.floor);
    const casino = CPU_CASINOS.find((entry) => entry.id === saved.casinoId) ?? CPU_CASINOS[0]!;
    const bet = saved.bet >= casino.minBetVC && saved.bet <= casino.maxBetVC
      ? saved.bet
      : casino.minBetVC;
    return {
      clock: saved.clock,
      tick: saved.tick,
      casinoId: casino.id,
      bet,
      notice: 'Spielstand geladen.',
    };
  } catch {
    return null;
  }
}
