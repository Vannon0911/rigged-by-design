/** RPG-Profil des Spielers: Aussehen, Player-Mods, Suspicion, Reputation. Headless. */
import { applyBouncerPenalty } from './bouncer';
import { DEFAULT_APPEARANCE, resolveVenue, type Appearance, type VenueId } from './appearance';
import type { Ledger, LedgerEntry } from '../economy/ledger';
import type { VaCoinMicro } from '../economy/vacoin';
import {
  collectEffects,
  cosmeticsFor,
  getPlayerMod,
  luckBiasFor,
  suspicionForUse,
  type ModCosmetic,
  type PlayerModId,
  type ResolvedEffects,
} from '../mods/player-mods';

export const MAX_EQUIPPED_PLAYER_MODS = 4;
export const SUSPICION_MAX = 100;

export interface ModUseResult {
  readonly suspicion: number;
  readonly ejected: boolean;
  readonly penalty: VaCoinMicro;
  readonly lockoutUntilTick: number;
  readonly ledgerEntry: LedgerEntry | null;
}

export class ProfileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProfileError';
  }
}

export class PlayerProfile {
  #appearance: Appearance = { ...DEFAULT_APPEARANCE };
  readonly #equipped: PlayerModId[] = [];
  #suspicion = 0;
  #reputation = 0;
  #lockoutUntilTick = 0;
  #lossStreak = 0;

  constructor(appearance: Partial<Appearance> = {}) {
    this.#appearance = { ...DEFAULT_APPEARANCE, ...appearance };
  }

  get appearance(): Readonly<Appearance> {
    return Object.freeze({ ...this.#appearance });
  }
  get equippedPlayerMods(): readonly PlayerModId[] {
    return Object.freeze([...this.#equipped]);
  }
  get cosmetics(): readonly ModCosmetic[] {
    return cosmeticsFor(this.#equipped);
  }
  get effects(): ResolvedEffects {
    return collectEffects(this.#equipped, 'CPU_CASINO_PLAYER');
  }
  get suspicion(): number {
    return this.#suspicion;
  }
  get reputation(): number {
    return this.#reputation;
  }
  get lossStreak(): number {
    return this.#lossStreak;
  }
  get luckBiasBps(): number {
    return luckBiasFor(this.#equipped, this.#lossStreak, 'CPU_CASINO_PLAYER');
  }
  get lockoutUntilTick(): number {
    return this.#lockoutUntilTick;
  }
  get venue(): VenueId { return resolveVenue(this.#reputation); }

  setAppearance(patch: Partial<Appearance>): void {
    this.#appearance = { ...this.#appearance, ...patch };
  }

  addReputation(points: number): void {
    if (!Number.isSafeInteger(points) || points < 0) throw new ProfileError('addReputation: Punkte muessen >= 0 sein');
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

  addSuspicion(points: number): void {
    if (!Number.isSafeInteger(points) || points < 0) throw new ProfileError('addSuspicion: Punkte muessen >= 0 sein');
    this.#suspicion = Math.min(SUSPICION_MAX, this.#suspicion + points);
  }

  isLockedOut(tick: number): boolean { return tick < this.#lockoutUntilTick; }

  registerModUse(id: PlayerModId, ledger: Ledger, tick: number): ModUseResult {
    if (!this.isEquipped(id)) throw new ProfileError(`${id} ist nicht ausgeruestet`);
    return this.addHeat(suspicionForUse(this.#equipped, id), ledger, tick);
  }

  /** Heat verbuchen. Bei 100: Rauswurf, 15 % Bargeld weg, 60 s CPU-Casino-Sperre. */
  addHeat(points: number, ledger: Ledger, tick: number): ModUseResult {
    if (this.isLockedOut(tick)) {
      throw new ProfileError(`CPU-Casino gesperrt bis Tick ${this.#lockoutUntilTick}`);
    }
    this.addSuspicion(points);
    if (this.#suspicion < SUSPICION_MAX) {
      return {
        suspicion: this.#suspicion,
        ejected: false,
        penalty: 0 as VaCoinMicro,
        lockoutUntilTick: this.#lockoutUntilTick,
        ledgerEntry: null,
      };
    }
    return this.#eject(ledger, tick);
  }

  /** Niete = payout 0, alles andere bricht die Pechserie. */
  recordSpin(payout: VaCoinMicro): void {
    this.#lossStreak = payout > 0 ? 0 : this.#lossStreak + 1;
  }

  #eject(ledger: Ledger, tick: number): ModUseResult {
    const { penalty, ledgerEntry, lockoutUntilTick } = applyBouncerPenalty(ledger, tick);
    this.#suspicion = 0;
    this.#lossStreak = 0;
    this.#lockoutUntilTick = lockoutUntilTick;
    return { suspicion: 0, ejected: true, penalty, lockoutUntilTick, ledgerEntry };
  }
}
