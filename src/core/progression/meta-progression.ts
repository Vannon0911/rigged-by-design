/** Meta-Progression: Syndikat-Siegel ueberleben den Run, Blaupausen und Startboni auch. */
import { addVC, fromVC, mulVC, type VaCoinMicro } from '../economy/vacoin';
import type { RunPerkId } from './run-perks';

export type MetaUnlockId =
  | 'META_START_CASH_5'
  | 'META_START_VAULT_10'
  | 'META_BLUEPRINT_TAX_FREE'
  | 'META_TRIBUTE_DISCOUNT'
  | 'META_START_CASH_20';

export interface MetaUnlock {
  readonly id: MetaUnlockId;
  readonly name: string;
  readonly description: string;
  readonly costTokens: number;
  readonly startCashVC?: VaCoinMicro;
  readonly startVaultVC?: VaCoinMicro;
  readonly blueprint?: RunPerkId;
}

export interface MetaProgress {
  readonly tokens: number;
  readonly totalTokensEarned: number;
  readonly runs: number;
  readonly bestRevenueVC: VaCoinMicro;
  readonly unlocks: readonly MetaUnlockId[];
  readonly blueprints: readonly RunPerkId[];
}

export const EMPTY_META: MetaProgress = {
  tokens: 0,
  totalTokensEarned: 0,
  runs: 0,
  bestRevenueVC: 0 as VaCoinMicro,
  unlocks: [],
  blueprints: [],
};

export const META_UNLOCKS: readonly MetaUnlock[] = [
  {
    id: 'META_START_CASH_5',
    name: 'Taschenpolster',
    description: 'Jeder neue Run startet mit +5.0000 VC in der Brieftasche.',
    costTokens: 1,
    startCashVC: fromVC(5),
  },
  {
    id: 'META_START_VAULT_10',
    name: 'Tresor-Reserve',
    description: 'Jeder neue Run startet mit +10.0000 VC Deckung im Tresor.',
    costTokens: 2,
    startVaultVC: fromVC(10),
  },
  {
    id: 'META_BLUEPRINT_TAX_FREE',
    name: 'Steuerfreie Kirschen',
    description: 'Blaupause fuer den naechsten Run: Kirschen zahlen ohne Syndikatsabzug.',
    costTokens: 3,
    blueprint: 'PERK_TAX_FREE_CHERRIES',
  },
  {
    id: 'META_TRIBUTE_DISCOUNT',
    name: 'Syndikats-Rabattkarte',
    description: 'Senkt jede Tribut-Forderung um 10 Prozent.',
    costTokens: 4,
  },
  {
    id: 'META_START_CASH_20',
    name: 'Mogul-Vorschuss',
    description: 'Jeder neue Run startet mit +20.0000 VC in der Brieftasche.',
    costTokens: 5,
    startCashVC: fromVC(20),
  },
];

const UNLOCK_INDEX = new Map(META_UNLOCKS.map((unlock) => [unlock.id, unlock]));

export function getMetaUnlock(id: MetaUnlockId): MetaUnlock {
  const unlock = UNLOCK_INDEX.get(id);
  if (!unlock) throw new Error(`Unbekannter Meta-Unlock: ${id}`);
  return unlock;
}

export function buyMetaUnlock(meta: MetaProgress, id: MetaUnlockId): MetaProgress {
  const unlock = getMetaUnlock(id);
  if (meta.unlocks.includes(id)) throw new Error(`${unlock.name} ist bereits freigeschaltet`);
  if (meta.tokens < unlock.costTokens) throw new Error(`Zu wenig Syndikat-Siegel fuer ${unlock.name}`);
  const blueprints = unlock.blueprint && !meta.blueprints.includes(unlock.blueprint)
    ? [...meta.blueprints, unlock.blueprint]
    : meta.blueprints;
  return {
    ...meta,
    tokens: meta.tokens - unlock.costTokens,
    unlocks: [...meta.unlocks, id],
    blueprints,
  };
}

export function metaStartCash(meta: MetaProgress): VaCoinMicro {
  return meta.unlocks.reduce((sum, id) => {
    const value = getMetaUnlock(id).startCashVC ?? 0;
    return addVC(sum, value as VaCoinMicro);
  }, 0 as VaCoinMicro);
}

export function metaStartVault(meta: MetaProgress): VaCoinMicro {
  return meta.unlocks.reduce((sum, id) => {
    const value = getMetaUnlock(id).startVaultVC ?? 0;
    return addVC(sum, value as VaCoinMicro);
  }, 0 as VaCoinMicro);
}

export function metaTributeDiscountBps(meta: MetaProgress): number {
  return meta.unlocks.includes('META_TRIBUTE_DISCOUNT') ? 1_000 : 0;
}

export function applyTributeDiscount(due: VaCoinMicro, meta: MetaProgress): VaCoinMicro {
  const discount = metaTributeDiscountBps(meta);
  return discount > 0 ? mulVC(due, 10_000 - discount) : due;
}

export function metaTokensForRevenue(revenue: VaCoinMicro): number {
  return Math.max(0, Math.min(50, Math.floor(revenue / fromVC(10))));
}

export function addRunRewards(meta: MetaProgress, revenue: VaCoinMicro, perks: readonly RunPerkId[]): MetaProgress {
  const earned = metaTokensForRevenue(revenue);
  const blueprints = [...meta.blueprints];
  for (const perk of perks) if (!blueprints.includes(perk)) blueprints.push(perk);
  return {
    ...meta,
    tokens: meta.tokens + earned,
    totalTokensEarned: meta.totalTokensEarned + earned,
    runs: meta.runs + 1,
    bestRevenueVC: revenue > meta.bestRevenueVC ? revenue : meta.bestRevenueVC,
    blueprints,
  };
}

