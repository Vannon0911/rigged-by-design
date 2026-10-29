/** Save-Adapter fuer den Progression-Store: versionierter Full-Save und neuer Run. */
import { Ledger } from '../core/economy/ledger';
import { addVC, fromVC } from '../core/economy/vacoin';
import { Prng } from '../core/rng/prng';
import { metaStartCash, metaStartVault, type MetaProgress } from '../core/progression/meta-progression';
import { RogueliteLoop, type RogueliteSnapshot } from '../core/progression/roguelite-loop';
import type { VenueTier } from '../core/progression/venues-and-tiers';
import { saveToStorage, serializeSave, type FullSave } from '../core/persistence/save-manager';
import { CasinoFloor } from '../core/simulation/casino-floor';
import { buildLedgerEntries } from '../core/persistence/save-manager';
import type { GameSave } from './game-save';
import { saveGameSave } from './game-save';
import { PLAYER_SAVE_KEY, type PlayerSaveState } from './player-store';

export interface FullSaveInput {
  readonly game: GameSave;
  readonly progression: RogueliteSnapshot;
  readonly venueTier: VenueTier;
  readonly player: PlayerSaveState;
}

export function buildFullSave(input: FullSaveInput): FullSave {
  return {
    schemaVersion: 1,
    savedAt: Date.now(),
    ledger: input.game.ledger,
    floor: input.game.floor,
    meta: input.progression.meta,
    progression: input.progression,
    venueTier: input.venueTier,
    player: { owned: input.player.owned, profile: input.player.profile },
    clock: input.game.clock,
    tick: input.game.tick,
    casinoId: input.game.casinoId,
    bet: input.game.bet,
    prngState: input.game.prngState,
  };
}

export function exportFull(input: FullSaveInput): string {
  return serializeSave(buildFullSave(input));
}

export function saveFull(input: FullSaveInput): void {
  saveToStorage(buildFullSave(input));
}

export function toGameSave(full: FullSave): GameSave {
  return {
    version: 1,
    ledger: full.ledger,
    floor: full.floor,
    clock: full.clock,
    tick: full.tick,
    casinoId: full.casinoId as GameSave['casinoId'],
    bet: full.bet,
    prngState: full.prngState,
  };
}

export function applyFullSave(full: FullSave): void {
  saveGameSave(toGameSave(full));
  if (full.player && typeof localStorage !== 'undefined') {
    const player: PlayerSaveState = {
      version: 1,
      owned: full.player.owned as PlayerSaveState['owned'],
      profile: full.player.profile,
    };
    localStorage.setItem(PLAYER_SAVE_KEY, JSON.stringify(player));
  }
  saveToStorage(full);
}

export function newRunArtifacts(meta: MetaProgress, player: PlayerSaveState): { game: GameSave; full: FullSave } {
  const ledger = new Ledger({ PLAYER_CASH: addVC(fromVC(5), metaStartCash(meta)) });
  const vault = metaStartVault(meta);
  if (vault > 0) ledger.transfer('EXTERNAL_WORK', 'CASINO_VAULT', vault, 'meta vault reserve', 0);
  const prng = new Prng((Date.now() ^ 0x51ed270b) >>> 0);
  const floor = new CasinoFloor(ledger, prng, { venueTier: 1, enforceVenue: true });
  floor.ensureStarterGame();
  const run = new RogueliteLoop(ledger, prng, { meta, runNumber: meta.runs + 1 });
  const game: GameSave = {
    version: 1,
    ledger: buildLedgerEntries(ledger),
    floor: floor.snapshot(),
    clock: 0,
    tick: 0,
    casinoId: 'CPU_DIVE_BAR',
    bet: fromVC(0.1),
    prngState: prng.getState(),
  };
  return {
    game,
    full: buildFullSave({ game, progression: run.snapshot, venueTier: 1, player }),
  };
}

export function persistNewRun(meta: MetaProgress, player: PlayerSaveState): void {
  const { game, full } = newRunArtifacts(meta, player);
  saveGameSave(game);
  saveToStorage(full);
}
