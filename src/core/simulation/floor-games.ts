/** Eine Besucher-Runde an einer Spielstaette: Slot, Huetchenspiel oder Wuerfeltisch. */
import type { VaCoinMicro } from '../economy/vacoin';
import { DEFAULT_DICE_CONFIG, playDiceRound } from '../games/dice/dice-engine';
import { DEFAULT_SHELL_CONFIG, playShellRound } from '../games/shell/shell-engine';
import type { Prng } from '../rng/prng';
import { spinSlot } from '../slot/slot-engine';
import type { PaylineId, SlotConfig } from '../slot/slot-types';
import { getBuildable, getOperatorMod, type BuildableId, type OperatorModId } from './catalog';

const THREE_LINES: readonly PaylineId[] = ['MIDDLE', 'TOP', 'BOTTOM'];
const ONE_LINE: readonly PaylineId[] = ['MIDDLE'];

export interface FloorGameOutcome {
  readonly totalBet: VaCoinMicro;
  readonly payout: VaCoinMicro;
  readonly isNearMiss: boolean;
  readonly isLDW: boolean;
}

export function playFloorGame(
  buildableId: BuildableId,
  mods: readonly OperatorModId[],
  betPerLine: VaCoinMicro,
  prng: Prng,
): FloorGameOutcome {
  const buildable = getBuildable(buildableId);

  if (buildable.kind === 'SLOT') {
    const config: SlotConfig = {
      id: `floor-${buildableId}`,
      baseBet: betPerLine,
      paylines: buildable.paylines >= 3 ? THREE_LINES : ONE_LINE,
      mods: mods.flatMap((id) => getOperatorMod(id).contracts),
    };
    const spin = spinSlot(config, prng, 10_000);
    return {
      totalBet: spin.totalBet,
      payout: spin.totalPayout,
      isNearMiss: spin.isNearMiss,
      isLDW: spin.isLDW,
    };
  }

  if (buildable.kind === 'SHELL') {
    const round = playShellRound({ ...DEFAULT_SHELL_CONFIG, id: `floor-${buildableId}` }, prng, betPerLine);
    return { totalBet: betPerLine, payout: round.payout, isNearMiss: round.isNearMiss, isLDW: false };
  }

  if (buildable.kind === 'DICE') {
    const round = playDiceRound({ ...DEFAULT_DICE_CONFIG, id: `floor-${buildableId}` }, prng, betPerLine);
    return { totalBet: betPerLine, payout: round.payout, isNearMiss: round.isNearMiss, isLDW: false };
  }

  throw new Error(`playFloorGame: ${buildableId} ist keine Spielstaette`);
}
