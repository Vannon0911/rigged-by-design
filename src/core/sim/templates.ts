/** Drei Floor-Blueprints: klein, mittel, gross. Regionen sind 30x30 Kacheln. */
import { fromVC, type VaCoinMicro } from '../economy/vacoin';
import { getBuildDef } from './offers';
import type { CarpetId, Furniture, GameId, PriceBook, TemplateId, WorldState, Zone } from './types';

const PRICES: PriceBook = {
  entryFee: fromVC(0),
  drinkPrice: fromVC(0.4),
  slotMinBet: fromVC(0.05),
  staffWage: fromVC(4),
  guardWage: fromVC(6),
  cleaningCost: fromVC(0.8),
  repairCost: fromVC(2),
};

const zone = (id: string, name: string, kind: Zone['kind'], x: number, y: number, w: number, h: number, color: number): Zone =>
  ({ id, name, kind, x, y, w, h, color });

function fixture(id: number, gameId: GameId, x: number, y: number, zoneId: string, seats?: number): Furniture {
  const def = getBuildDef(gameId);
  return {
    id, kind: def.kind, gameId, x, y, w: def.w, h: def.h, seats: seats ?? def.seats,
    label: def.name, price: def.cost, quality: def.quality, condition: 100, dirt: 0,
    zoneId, occupants: [], mods: [], reels: def.reels, baseBet: def.baseBet,
  };
}

function freeFixture(id: number, gameId: GameId, x: number, y: number, zoneId: string): Furniture {
  return { ...fixture(id, gameId, x, y, zoneId), price: fromVC(0) };
}

function extra(id: number, kind: Furniture['kind'], label: string, x: number, y: number, w: number, h: number, seats: number, zoneId: string): Furniture {
  return {
    id, kind, label, x, y, w, h, seats, price: fromVC(0), quality: 1, condition: 100,
    dirt: 0, zoneId, occupants: [], mods: [], reels: 0, baseBet: 0 as VaCoinMicro,
  };
}

const SMALL_ZONES = [
  zone('entrance', 'Eingang', 'ENTRANCE', 1, 12, 5, 6, 0x2b4c4a),
  zone('exchange', 'Wechselkasse', 'EXCHANGE', 7, 11, 5, 7, 0x59452a),
  zone('gaming', 'Spielsaal', 'GAMING', 13, 3, 15, 13, 0x3d2456),
  zone('bar', 'Bar', 'BAR', 13, 18, 9, 8, 0x54243b),
  zone('toilet', 'Klo', 'TOILET', 23, 18, 6, 8, 0x243a54),
  zone('lounge', 'Lounge', 'LOUNGE', 6, 21, 6, 5, 0x2d3b2d),
  zone('storage', 'Lager', 'STORAGE', 1, 25, 4, 3, 0x2a2a2a),
];

const MEDIUM_ZONES = [
  zone('entrance', 'Eingang', 'ENTRANCE', 1, 26, 8, 8, 0x2b4c4a),
  zone('exchange', 'Wechselkasse', 'EXCHANGE', 10, 24, 8, 9, 0x59452a),
  zone('gaming', 'Spielsaal', 'GAMING', 20, 4, 28, 30, 0x3d2456),
  zone('bar', 'Bar', 'BAR', 20, 38, 16, 12, 0x54243b),
  zone('toilet', 'Klo', 'TOILET', 38, 38, 10, 12, 0x243a54),
  zone('lounge', 'Lounge', 'LOUNGE', 50, 4, 8, 14, 0x2d3b2d),
  zone('storage', 'Lager', 'STORAGE', 50, 38, 8, 18, 0x2a2a2a),
];

const LARGE_ZONES = [
  zone('entrance', 'Eingang', 'ENTRANCE', 1, 40, 10, 10, 0x2b4c4a),
  zone('exchange', 'Wechselkasse', 'EXCHANGE', 13, 38, 10, 12, 0x59452a),
  zone('gaming', 'Spielsaal', 'GAMING', 28, 8, 42, 42, 0x3d2456),
  zone('bar', 'Bar', 'BAR', 28, 54, 22, 18, 0x54243b),
  zone('toilet', 'Klo', 'TOILET', 54, 54, 14, 18, 0x243a54),
  zone('lounge', 'Lounge', 'LOUNGE', 74, 8, 10, 22, 0x2d3b2d),
  zone('storage', 'Lager', 'STORAGE', 74, 58, 10, 24, 0x2a2a2a),
];

function small(): Furniture[] {
  return [
    extra(1, 'EXCHANGE', 'Wechselkasse', 8, 13, 2, 3, 1, 'exchange'),
    freeFixture(2, 'SLOT', 16, 6, 'gaming'),
    extra(3, 'BAR', 'Theke', 14, 19, 5, 2, 3, 'bar'),
    extra(4, 'TOILET', 'Kabine', 24, 20, 2, 2, 2, 'toilet'),
    extra(5, 'DECOR', 'Pflanze', 27, 22, 1, 1, 0, 'lounge'),
    extra(6, 'DECOR', 'Sofa', 17, 24, 3, 1, 2, 'lounge'),
  ];
}

function medium(): Furniture[] {
  return [
    extra(1, 'EXCHANGE', 'Wechselkasse', 11, 26, 3, 3, 1, 'exchange'),
    fixture(2, 'SLOT', 23, 8, 'gaming'),
    fixture(3, 'SLOT', 29, 8, 'gaming'),
    fixture(4, 'SLOT', 35, 8, 'gaming'),
    fixture(5, 'PLINKO', 41, 8, 'gaming'),
    fixture(6, 'BLACKJACK', 23, 18, 'gaming'),
    fixture(7, 'POKER', 30, 18, 'gaming'),
    fixture(8, 'ROULETTE', 38, 18, 'gaming'),
    fixture(9, 'SHELL', 30, 27, 'gaming'),
    fixture(10, 'DICE', 38, 27, 'gaming'),
    extra(11, 'BAR', 'Theke', 22, 40, 10, 3, 5, 'bar'),
    extra(12, 'TOILET', 'Kabine', 40, 40, 3, 3, 3, 'toilet'),
    extra(13, 'DECOR', 'Pflanze', 54, 8, 1, 1, 0, 'lounge'),
    extra(14, 'DECOR', 'Sofa', 52, 26, 3, 1, 2, 'lounge'),
  ];
}

function large(): Furniture[] {
  return [
    extra(1, 'EXCHANGE', 'Wechselkasse', 15, 41, 4, 4, 1, 'exchange'),
    fixture(2, 'SLOT', 31, 12, 'gaming'),
    fixture(3, 'SLOT', 38, 12, 'gaming'),
    fixture(4, 'SLOT', 45, 12, 'gaming'),
    fixture(5, 'SLOT', 52, 12, 'gaming'),
    fixture(6, 'PLINKO', 59, 12, 'gaming'),
    fixture(7, 'BLACKJACK', 31, 22, 'gaming'),
    fixture(8, 'POKER', 39, 22, 'gaming'),
    fixture(9, 'ROULETTE', 48, 22, 'gaming'),
    fixture(10, 'SHELL', 31, 32, 'gaming'),
    fixture(11, 'DICE', 38, 32, 'gaming'),
    fixture(12, 'SLOT', 48, 32, 'gaming'),
    extra(13, 'BAR', 'Theke', 31, 58, 14, 3, 7, 'bar'),
    extra(14, 'TOILET', 'Kabine', 58, 58, 4, 4, 4, 'toilet'),
    extra(15, 'DECOR', 'Pflanze', 80, 12, 1, 1, 0, 'lounge'),
    extra(16, 'DECOR', 'Sofa', 77, 28, 3, 1, 2, 'lounge'),
  ];
}

const BLUEPRINTS: Readonly<Record<TemplateId, { size: number; zones: readonly Zone[]; furniture: () => Furniture[] }>> = {
  SMALL: { size: 30, zones: SMALL_ZONES, furniture: small },
  MEDIUM: { size: 60, zones: MEDIUM_ZONES, furniture: medium },
  LARGE: { size: 90, zones: LARGE_ZONES, furniture: large },
};

export const TEMPLATE_COST: Readonly<Record<TemplateId, VaCoinMicro>> = {
  SMALL: fromVC(30),
  MEDIUM: fromVC(120),
  LARGE: fromVC(600),
};

export function createWorld(template: TemplateId, carpet: CarpetId = 'VIOLET'): WorldState {
  const blueprint = BLUEPRINTS[template];
  return {
    template,
    size: blueprint.size,
    zones: blueprint.zones,
    furniture: blueprint.furniture(),
    guests: [],
    player: { position: { x: 2, y: 15 }, path: [], pathIndex: 0, carrying: '' },
    dirty: new Set<number>(),
    prices: { ...PRICES },
    staff: { guard: false, cleaner: false, bartender: false },
    carpet,
    tick: 0,
    day: 1,
    nextGuestId: 1,
    nextFurnitureId: 100,
    lastEvent: template === 'SMALL' ? 'Kleine Bude eröffnet. Ein Automat steht gratis.' : 'Neues Haus eröffnet.',
    guardsHired: 0,
  };
}

/** Nach dem Laden: ein Casino ohne Spielgeraet bekommt seinen Gratis-Startautomaten zurueck. */
export function ensureStarter(world: WorldState): void {
  if (world.furniture.some((item) => item.gameId)) return;
  const def = getBuildDef('SLOT');
  world.furniture.push({
    id: world.nextFurnitureId++, kind: 'SLOT', gameId: 'SLOT', x: 16, y: 6, w: 2, h: 3, seats: 1,
    label: def.name, price: fromVC(0), quality: def.quality, condition: 100, dirt: 0,
    zoneId: 'gaming', occupants: [], mods: [], reels: 3, baseBet: def.baseBet,
  });
}
