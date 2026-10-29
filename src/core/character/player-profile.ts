/** RPG-Profil des Spielers: Aussehen, Player-Mods, Suspicion, Reputation. Headless. */
import { DEFAULT_APPEARANCE, resolveVenue, type Appearance, type VenueId } from './appearance';
import { ProfileError } from './profile-error';
import { SuspicionMeter, type ModUseResult } from './suspicion-meter';
import type { Ledger } from '../economy/ledger';
import type { VaCoinMicro } from '../economy/vacoin';
import {
  PLAYER_MODS,
  collectEffects,
  cosmeticsFor,
  getPlayerMod,
  luckBiasFor,
  suspicionForUse,
  type ModCosmetic,
  type PlayerModId,
  type ResolvedEffects,
} from '../mods/player-mods';

export { ProfileError } from './profile-error';
export { SUSPICION_MAX } from './suspicion-meter';
export type { ModUseResult } from './suspicion-meter';

export const MAX_EQUIPPED_PLAYER_MODS = 4;

export interface PlayerProfileState {
  readonly appearance: Appearance;
  readonly equipped: readonly PlayerModId[];
  readonly suspicion: number;
  readonly reputation: number;
  readonly lockoutUntilTick: number;
  readonly lossStreak: number;
}

export interface PlayerProfileView {
  readonly appearance: Readonly<Appearance>;
  readonly cosmetics: readonly ModCosmetic[];
  readonly equippedPlayerMods: readonly PlayerModId[];
  readonly suspicion: number;
  readonly reputation: number;
  readonly venue: VenueId;
  readonly effects: ResolvedEffects;
  readonly luckBiasBps: number;
}

export class PlayerProfile {
  #appearance: Appearance = { ...DEFAULT_APPEARANCE };
  readonly #equipped: PlayerModId[] = [];
  #reputation = 0;
  readonly #meter = new SuspicionMeter();

  constructor(appearance: Partial<Appearance> = {}) {
    this.#appearance = { ...DEFAULT_APPEARANCE, ...appearance };
  }

  get appearance(): Readonly<Appearance> { return Object.freeze({ ...this.#appearance }); }
  get equippedPlayerMods(): readonly PlayerModId[] { return Object.freeze([...this.#equipped]); }
  get cosmetics(): readonly ModCosmetic[] { return cosmeticsFor(this.#equipped); }
  get effects(): ResolvedEffects { return collectEffects(this.#equipped, 'CPU_CASINO_PLAYER'); }
  get suspicion(): number { return this.#meter.suspicion; }
  get reputation(): number { return this.#reputation; }
  get lossStreak(): number { return this.#meter.lossStreak; }
  get luckBiasBps(): number { return luckBiasFor(this.#equipped, this.lossStreak, 'CPU_CASINO_PLAYER'); }
  get lockoutUntilTick(): number { return this.#meter.lockoutUntilTick; }
  get venue(): VenueId { return resolveVenue(this.#reputation); }

  toState(): PlayerProfileState {
    return {
      appearance: this.appearance,
      equipped: [...this.#equipped],
      suspicion: this.suspicion,
      reputation: this.#reputation,
      lockoutUntilTick: this.lockoutUntilTick,
      lossStreak: this.lossStreak,
    };
  }

  loadState(state: Partial<PlayerProfileState>): void {
    const safe = (value: number | undefined): number =>
      Number.isFinite(value) ? Math.max(0, Math.floor(value!)) : 0;
    this.#appearance = { ...DEFAULT_APPEARANCE, ...state.appearance };
    this.#equipped.length = 0;
    for (const id of state.equipped ?? []) {
      if (this.#equipped.length >= MAX_EQUIPPED_PLAYER_MODS) break;
      if (this.#equipped.includes(id) || !PLAYER_MODS.some((mod) => mod.id === id)) continue;
      this.#equipped.push(id);
    }
    this.#reputation = safe(state.reputation);
    this.#meter.load(state);
  }

  setAppearance(patch: Partial<Appearance>): void {
    this.#appearance = { ...this.#appearance, ...patch };
  }

  addReputation(points: number): void {
    if (!Number.isSafeInteger(points) || points < 0) {
      throw new ProfileError('addReputation: Punkte muessen >= 0 sein');
    }
    this.#reputation += points;
  }

  isEquipped(id: PlayerModId): boolean { return this.#equipped.includes(id); }

  equipMod(id: PlayerModId, owned?: readonly PlayerModId[]): void {
    const mod = getPlayerMod(id);
    if (mod.scope !== 'PLAYER_ONLY') throw new ProfileError(`${id}: Player-Mods duerfen nur den Spieler betreffen`);
    if (owned && !owned.includes(id)) throw new ProfileError(`${id} ist nicht im Besitz`);
    if (this.isEquipped(id)) throw new ProfileError(`${id} ist bereits ausgeruestet`);
    if (this.#equipped.length >= MAX_EQUIPPED_PLAYER_MODS) {
      throw new ProfileError(`Maximal ${MAX_EQUIPPED_PLAYER_MODS} Player-Mods gleichzeitig`);
    }
    this.#equipped.push(id);
  }

  unequipMod(id: PlayerModId): void {
    const index = this.#equipped.indexOf(id);
    if (index === -1) throw new ProfileError(`${id} ist nicht ausgeruestet`);
    this.#equipped.splice(index, 1);
  }

  addSuspicion(points: number): void { this.#meter.addSuspicion(points); }
  isLockedOut(tick: number): boolean { return this.#meter.isLockedOut(tick); }

  registerModUse(id: PlayerModId, ledger: Ledger, tick: number): ModUseResult {
    if (!this.isEquipped(id)) throw new ProfileError(`${id} ist nicht ausgeruestet`);
    return this.#meter.addHeat(suspicionForUse(this.#equipped, id), ledger, tick);
  }

  addHeat(points: number, ledger: Ledger, tick: number): ModUseResult {
    return this.#meter.addHeat(points, ledger, tick);
  }

  recordSpin(payout: VaCoinMicro): void { this.#meter.recordSpin(payout); }
}
