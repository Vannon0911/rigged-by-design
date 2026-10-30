/**
 * Unternehmensfortschritt: das Casino waechst, nicht der Charakter.
 * Jede Stufe nennt ihre echten Bedingungen mit Ist und Soll; nichts ist unsichtbar.
 */
import type { Ledger } from '../economy/ledger';
import { HAUSKONTO } from './money';
import { BUILD_DEFS, type BuildId } from './offers';
import type { WorldState } from './types';

type CompanyTierId = 'BUDE' | 'KASSE' | 'SAAL' | 'KONZERN';
type CompanyMetricId = 'day' | 'capital' | 'revenue' | 'reputation' | 'served' | 'games';

/** Nur fuer die Anzeige: Betraege in ganzen VC, nie als gespeicherter Geldwert. */
const MICRO = 10_000;

interface CompanyMetric {
  readonly id: CompanyMetricId;
  readonly label: string;
  readonly need: number;
  readonly current: number;
  readonly met: boolean;
}

interface CompanyStatus {
  readonly tier: CompanyTierId;
  readonly name: string;
  readonly note: string;
  readonly next: { readonly id: CompanyTierId; readonly name: string } | null;
  /** Was bis zur naechsten Stufe fehlt, mit echten Werten. */
  readonly open: readonly CompanyMetric[];
  readonly unlocked: readonly BuildId[];
  readonly locked: readonly { readonly id: BuildId; readonly name: string; readonly tier: CompanyTierId }[];
}

interface Need {
  readonly id: CompanyMetricId;
  readonly label: string;
  readonly need: number;
}

interface TierDef {
  readonly id: CompanyTierId;
  readonly name: string;
  readonly note: string;
  readonly needs: readonly Need[];
}

const TIERS: readonly TierDef[] = [
  { id: 'BUDE', name: 'Hinterhof-Bude', note: 'Ein Automat, offene Kasse, kein Polster.', needs: [] },
  {
    id: 'KASSE', name: 'Bude mit Kasse', note: 'Die Kasse klingelt, das Haus traegt sich selbst.',
    needs: [
      { id: 'day', label: 'Tage offen', need: 3 },
      { id: 'revenue', label: 'Einnahmen (VC)', need: 20 },
      { id: 'served', label: 'bediente Gäste', need: 15 },
    ],
  },
  {
    id: 'SAAL', name: 'Spielsaal', note: 'Mehrere Tische, eigener Ruf, echte Ausstattung.',
    needs: [
      { id: 'reputation', label: 'Ruf', need: 45 },
      { id: 'revenue', label: 'Einnahmen (VC)', need: 120 },
      { id: 'games', label: 'Spielgeräte', need: 6 },
      { id: 'capital', label: 'Kapital (VC)', need: 60 },
    ],
  },
  {
    id: 'KONZERN', name: 'Konzern', note: 'Mehrere Säle, eigene Regeln, eigener Ruf.',
    needs: [
      { id: 'reputation', label: 'Ruf', need: 70 },
      { id: 'revenue', label: 'Einnahmen (VC)', need: 400 },
      { id: 'games', label: 'Spielgeräte', need: 12 },
      { id: 'capital', label: 'Kapital (VC)', need: 300 },
    ],
  },
];

/** Welche Stufe ein Objekt freischaltet. Alles darunter bleibt sichtbar, aber gesperrt. */
const BUILD_TIER: Readonly<Record<BuildId, CompanyTierId>> = {
  SLOT: 'BUDE', SHELL: 'BUDE', PLANT: 'BUDE', SOFA: 'BUDE',
  PLINKO: 'KASSE', DICE: 'KASSE',
  BLACKJACK: 'SAAL', POKER: 'SAAL',
  ROULETTE: 'KONZERN',
};

/** Einnahmen aus Gastbuchungen; Zuschuesse von aussen zaehlen nicht als Umsatz. */
export function revenueOf(ledger: Ledger): number {
  let total = 0;
  for (const entry of ledger.entries) {
    if (entry.to === HAUSKONTO && entry.from.startsWith('VISITOR_')) total += entry.amount;
  }
  return Math.floor(total / MICRO);
}

function valueOf(id: CompanyMetricId, world: WorldState, ledger: Ledger): number {
  switch (id) {
    case 'day': return world.day;
    case 'capital': return Math.floor(ledger.getBalance(HAUSKONTO) / MICRO);
    case 'revenue': return revenueOf(ledger);
    case 'reputation': return Math.round(world.reputation);
    case 'served': return world.guestsServed;
    case 'games': return world.furniture.filter((item) => item.gameId).length;
  }
}

const metricsFor = (tier: TierDef, world: WorldState, ledger: Ledger): CompanyMetric[] =>
  tier.needs.map((need) => {
    const current = valueOf(need.id, world, ledger);
    return { id: need.id, label: need.label, need: need.need, current, met: current >= need.need };
  });

function reached(tier: TierDef, world: WorldState, ledger: Ledger): boolean {
  return metricsFor(tier, world, ledger).every((metric) => metric.met);
}

const tierById = (id: CompanyTierId): TierDef => TIERS.find((tier) => tier.id === id)!;
const order = (id: CompanyTierId): number => TIERS.findIndex((tier) => tier.id === id);

export function companyTier(world: WorldState, ledger: Ledger): CompanyTierId {
  let current: CompanyTierId = 'BUDE';
  for (const tier of TIERS) {
    if (reached(tier, world, ledger)) current = tier.id;
  }
  return current;
}

export function companyStatus(world: WorldState, ledger: Ledger): CompanyStatus {
  const tierId = companyTier(world, ledger);
  const tier = tierById(tierId);
  const nextTier = TIERS[order(tierId) + 1] ?? null;
  const all = nextTier ? metricsFor(nextTier, world, ledger) : [];
  const rank = order(tierId);
  return {
    tier: tierId,
    name: tier.name,
    note: tier.note,
    next: nextTier ? { id: nextTier.id, name: nextTier.name } : null,
    open: all.filter((metric) => !metric.met),
    unlocked: BUILD_DEFS.filter((def) => order(BUILD_TIER[def.id]) <= rank).map((def) => def.id),
    locked: BUILD_DEFS
      .filter((def) => order(BUILD_TIER[def.id]) > rank)
      .map((def) => ({ id: def.id, name: def.name, tier: BUILD_TIER[def.id] })),
  };
}

export const requiredTier = (buildId: BuildId): CompanyTierId => BUILD_TIER[buildId];

export function isUnlocked(world: WorldState, ledger: Ledger, buildId: BuildId): boolean {
  return order(BUILD_TIER[buildId]) <= order(companyTier(world, ledger));
}

/** Kaufbremse: die Sperre nennt Stufe und fehlende Bedingung statt nur "geht nicht". */
export function assertUnlocked(world: WorldState, ledger: Ledger, buildId: BuildId): void {
  if (isUnlocked(world, ledger, buildId)) return;
  const status = companyStatus(world, ledger);
  const need = requiredTier(buildId);
  const missing = status.open.map((metric) => `${metric.label} ${metric.current}/${metric.need}`).join(', ');
  throw new Error(`${buildId} braucht Stufe ${tierById(need).name}. Noch offen: ${missing || 'weiter ausbauen'}.`);
}
