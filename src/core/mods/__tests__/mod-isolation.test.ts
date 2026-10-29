import { describe, expect, it } from 'vitest';
import { BOUNCER_PENALTY_BPS, CPU_CASINO_LOCKOUT_SECONDS } from '../../character/bouncer';
import { MAX_EQUIPPED_PLAYER_MODS, PlayerProfile } from '../../character/player-profile';
import { Ledger } from '../../economy/ledger';
import { BPS_DENOMINATOR, fromVC, toVCString, type VaCoinMicro } from '../../economy/vacoin';
import { collectEffects, NEUTRAL_EFFECTS, PLAYER_MODS, suspicionForUse, type PlayerModId } from '../player-mods';

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return {
    nextFloat(): number {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    nextInt(min: number, max: number): number {
      return min + Math.floor(this.nextFloat() * (max - min + 1));
    },
  };
}

/** Einfaches CPU-Wuerfelspiel: Wette auf 4-6, Auszahlung 2x (plus Mod-Bonus). */
function playCpuDice(equipped: readonly PlayerModId[], rolls: number, seed: number) {
  const effects = collectEffects(equipped, 'CPU_CASINO_PLAYER');
  const prng = mulberry32(seed);
  let wins = 0;
  for (let i = 0; i < rolls; i += 1) {
    const raw = prng.nextInt(1, 6);
    const shift = prng.nextFloat() < effects.diceShiftBps / BPS_DENOMINATOR;
    const roll = shift ? Math.min(6, raw + 1) : raw;
    if (roll >= 4) wins += 1;
  }
  const payout = 2 * (1 + effects.payoutBonusBps / BPS_DENOMINATOR);
  return { wins, winRate: (wins / rolls) * 100, rtp: (wins * payout) / rolls };
}

/** Besucher-Spin im eigenen Casino: gewichtete Symbole, zahlt nach Tabelle. */
function visitorSpins(equipped: readonly PlayerModId[], spins: number, seed: number): number[] {
  const effects = collectEffects(equipped, 'OWN_CASINO_VISITOR');
  const prng = mulberry32(seed);
  const weights = [50, 30 + Math.round((30 * effects.mediumWeightBonusBps) / BPS_DENOMINATOR), 15, 5];
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const pays = [0, 2, 5, 20].map((pay) =>
    Math.round((pay * (BPS_DENOMINATOR + effects.payoutBonusBps)) / BPS_DENOMINATOR),
  );
  const outcomes: number[] = [];
  for (let i = 0; i < spins; i += 1) {
    let roll = prng.nextFloat() * total;
    let index = weights.length - 1;
    for (let w = 0; w < weights.length; w += 1) {
      roll -= weights[w] ?? 0;
      if (roll < 0) {
        index = w;
        break;
      }
    }
    outcomes.push(pays[index] ?? 0);
  }
  return outcomes;
}

describe('Player-Mod-Isolation', () => {
  it('jede Player-Mod ist PLAYER_ONLY und schaltet ein sichtbares Bauteil frei', () => {
    expect(PLAYER_MODS).toHaveLength(5);
    for (const mod of PLAYER_MODS) {
      expect(mod.scope).toBe('PLAYER_ONLY');
      expect(mod.cosmetic.partId.length).toBeGreaterThan(0);
    }
    const profile = new PlayerProfile({ outfitId: 'SUIT' });
    profile.equipMod('PMOD_LOADED_DICE');
    expect(profile.cosmetics.map((part) => part.partId)).toContain('LOADED_DIE');
    expect(profile.appearance.outfitId).toBe('SUIT');
    profile.unequipMod('PMOD_LOADED_DICE');
    expect(profile.cosmetics).toHaveLength(0);
  });

  it('erhoeht die Gewinnquote im CPU-Casino messbar', () => {
    const base = playCpuDice([], 20_000, 424242);
    const loaded = playCpuDice(['PMOD_LOADED_DICE'], 20_000, 424242);
    const bribed = playCpuDice(['PMOD_BRIBE_RING'], 20_000, 424242);
    const both = playCpuDice(['PMOD_LOADED_DICE', 'PMOD_BRIBE_RING'], 20_000, 424242);

    expect(Math.abs(base.winRate - 50)).toBeLessThan(1.5);
    expect(loaded.winRate - base.winRate).toBeGreaterThan(1);
    expect(loaded.rtp).toBeGreaterThan(base.rtp + 0.02);
    expect(bribed.winRate).toBe(base.winRate);
    expect(bribed.rtp).toBeGreaterThan(base.rtp + 0.03);
    expect(both.rtp).toBeGreaterThan(bribed.rtp);
  });

  it('hat exakt 0 % Einfluss auf Spins von NPC-Besuchern im eigenen Casino', () => {
    const equipped: readonly PlayerModId[] = PLAYER_MODS.map((mod) => mod.id);
    expect(collectEffects(equipped, 'OWN_CASINO_VISITOR')).toBe(NEUTRAL_EFFECTS);
    expect(visitorSpins(equipped, 5_000, 987654)).toEqual(visitorSpins([], 5_000, 987654));
    expect(visitorSpins(equipped, 5_000, 13)).toEqual(visitorSpins([], 5_000, 13));
  });

  it('Syndikats-Ring halbiert den Suspicion-Anstieg anderer Mods', () => {
    const profile = new PlayerProfile();
    profile.equipMod('PMOD_BRIBE_RING');
    profile.equipMod('PMOD_LOADED_DICE');
    expect(suspicionForUse(profile.equippedPlayerMods, 'PMOD_LOADED_DICE')).toBe(2);
    expect(suspicionForUse(profile.equippedPlayerMods, 'PMOD_BRIBE_RING')).toBe(0);
  });

  it('verbucht Suspicion 100 als 15-%-Strafe und 60-s-Sperre ueber das Ledger', () => {
    const ledger = new Ledger({ PLAYER_CASH: fromVC(1000), CPU_CASINO_POOL: fromVC(0) });
    const profile = new PlayerProfile();
    profile.equipMod('PMOD_LOADED_DICE');

    let ejection = null as ReturnType<PlayerProfile['addHeat']> | null;
    let tick = 0;
    for (; tick < 40 && !ejection; tick += 1) {
      const result = profile.registerModUse('PMOD_LOADED_DICE', ledger, tick);
      if (result.ejected) ejection = result;
    }

    expect(ejection?.ejected).toBe(true);
    expect(toVCString(ejection?.penalty ?? (0 as VaCoinMicro))).toBe('150.0000 VC');
    expect(ledger.getBalance('PLAYER_CASH')).toBe(fromVC(850));
    expect(ledger.getBalance('CPU_CASINO_POOL')).toBe(fromVC(150));
    expect(ejection?.ledgerEntry?.from).toBe('PLAYER_CASH');
    expect(ejection?.ledgerEntry?.to).toBe('CPU_CASINO_POOL');
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
    expect(profile.suspicion).toBe(0);
    expect(profile.isLockedOut(tick)).toBe(true);
    expect(profile.isLockedOut(tick + CPU_CASINO_LOCKOUT_SECONDS)).toBe(false);
    expect(() => profile.registerModUse('PMOD_LOADED_DICE', ledger, tick + 1)).toThrow(/gesperrt/);
    expect(BOUNCER_PENALTY_BPS).toBe(1500);
  });

  it('respektiert das Limit von vier gleichzeitig ausgeruesteten Mods', () => {
    const profile = new PlayerProfile();
    for (const mod of PLAYER_MODS.slice(0, MAX_EQUIPPED_PLAYER_MODS)) profile.equipMod(mod.id);
    expect(profile.equippedPlayerMods).toHaveLength(MAX_EQUIPPED_PLAYER_MODS);
    expect(() => profile.equipMod(PLAYER_MODS[MAX_EQUIPPED_PLAYER_MODS]!.id)).toThrow(/Maximal 4/);
  });
});
