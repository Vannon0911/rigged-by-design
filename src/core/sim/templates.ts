/** Drei Floor-Blueprints: klein, mittel, gross. Jeder Bereich ist 30x30 Kacheln. */
import { fromVC, type VaCoinMicro } from '../economy/vacoin';
import { SERVICE_FOOTPRINT } from './grid-zones';
import { getBuildDef } from './offers';
import type { CarpetId, Furniture, GameId, PriceBook, TemplateId, WorldState, Zone } from './types';

const PRICES: PriceBook = {
  entryFee: fromVC(0),
  drinkPrice: fromVC(0.4),
  slotMinBet: fromVC(0.05),
  staffWage: fromVC(4),
  guardWage: fromVC(6),
  cashierWage: fromVC(5),
  porterWage: fromVC(3),
  cleaningCost: fromVC(0.8),
  repairCost: fromVC(2),
  partCost: fromVC(1.5),
  drinkCrateCost: fromVC(0.6),
  barUpgrade: fromVC(30),
  wcUpgrade: fromVC(15),
};

const zone = (id: string, name: string, kind: Zone['kind'], x: number, y: number, w: number, h: number, color: number): Zone =>
  ({ id, name, kind, x, y, w, h, color });

function fixture(id: number, gameId: GameId, x: number, y: number, zoneId: string): Furniture {
  const def = getBuildDef(gameId);
  return {
    id, kind: def.kind, gameId, x, y, w: def.w, h: def.h, seats: def.seats,
    label: def.name, price: def.cost, quality: def.quality, condition: 100, damaged: false, dirt: 0,
    stock: 0, clog: 0, clogged: false, zoneId, occupants: [], mods: [], reels: def.reels, baseBet: def.baseBet,
  };
}

function freeFixture(id: number, gameId: GameId, x: number, y: number, zoneId: string): Furniture {
  return { ...fixture(id, gameId, x, y, zoneId), price: fromVC(0) };
}

function service(id: number, kind: 'EXCHANGE' | 'BAR' | 'TOILET' | 'STORAGE', label: string, x: number, y: number, zoneId: string): Furniture {
  const fp = SERVICE_FOOTPRINT[kind];
  return {
    id, kind, label, x, y, w: fp.w, h: fp.h, seats: fp.seats, price: fromVC(0), quality: 1,
    condition: 100, damaged: false, dirt: 0, clog: 0, clogged: false,
    stock: kind === 'BAR' ? 4 : 0,
    zoneId, occupants: [], mods: [], reels: 0, baseBet: 0 as VaCoinMicro,
  };
}

function decor(id: number, label: string, x: number, y: number, w: number, h: number, seats: number, zoneId: string): Furniture {
  return {
    id, kind: 'DECOR',    label, x, y, w, h, seats, price: fromVC(0), quality: 1, condition: 100, damaged: false,
    dirt: 0, stock: 0, clog: 0, clogged: false, zoneId, occupants: [], mods: [], reels: 0, baseBet: 0 as VaCoinMicro,
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
    service(1, 'EXCHANGE', 'Wechselkasse', 8, 13, 'exchange'),
    freeFixture(2, 'SLOT', 16, 6, 'gaming'),
    service(3, 'BAR', 'Theke', 14, 19, 'bar'),
    service(4, 'TOILET', 'Kabine', 24, 20, 'toilet'),
    decor(5, 'Pflanze', 10, 22, 1, 1, 0, 'lounge'),
    decor(6, 'Sofa', 7, 24, 2, 1, 2, 'lounge'),
    service(7, 'STORAGE', 'Lager', 1, 25, 'storage'),
  ];
}

function medium(): Furniture[] {
  return [
    service(1, 'EXCHANGE', 'Wechselkasse', 11, 26, 'exchange'),
    fixture(2, 'SLOT', 23, 8, 'gaming'),
    fixture(3, 'SLOT', 29, 8, 'gaming'),
    fixture(4, 'SLOT', 35, 8, 'gaming'),
    fixture(5, 'PLINKO', 41, 8, 'gaming'),
    fixture(6, 'BLACKJACK', 23, 18, 'gaming'),
    fixture(7, 'POKER', 30, 18, 'gaming'),
    fixture(8, 'ROULETTE', 38, 18, 'gaming'),
    fixture(9, 'SHELL', 30, 27, 'gaming'),
    fixture(10, 'DICE', 38, 27, 'gaming'),
    service(11, 'BAR', 'Theke', 22, 40, 'bar'),
    service(12, 'TOILET', 'Kabine', 40, 40, 'toilet'),
    decor(13, 'Pflanze', 54, 8, 1, 1, 0, 'lounge'),
    decor(14, 'Sofa', 52, 10, 2, 1, 2, 'lounge'),
    service(15, 'STORAGE', 'Lager', 51, 40, 'storage'),
  ];
}

function large(): Furniture[] {
  return [
    service(1, 'EXCHANGE', 'Wechselkasse', 15, 41, 'exchange'),
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
    service(13, 'BAR', 'Theke', 31, 58, 'bar'),
    service(14, 'TOILET', 'Kabine', 58, 58, 'toilet'),
    decor(15, 'Pflanze', 80, 12, 1, 1, 0, 'lounge'),
    decor(16, 'Sofa', 77, 28, 2, 1, 2, 'lounge'),
    service(17, 'STORAGE', 'Lager', 75, 60, 'storage'),
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
  const entrance = blueprint.zones.find((zone) => zone.kind === 'ENTRANCE');
  return {
    template,
    size: blueprint.size,
    zones: blueprint.zones,
    furniture: blueprint.furniture(),
    guests: [],
    player: { position: { x: entrance ? entrance.x + 2 : 2, y: entrance ? entrance.y + 2 : 15 }, path: [], pathIndex: 0, carrying: '' },
    dirty: new Set<number>(),
    prices: { ...PRICES },
    staff: { guard: false, cleaner: false, bartender: false, cashier: false, porter: false },
    carpet,
    tick: 0,
    day: 1,
    nextGuestId: 1,
    nextFurnitureId: 100,
    crates: [],
    agents: [],
    disputes: [],
    parts: 2,
    guestsServed: 0,
    reputation: 0,
    wallColor: '#241a35',
    neonColor: '#00ffcc',
    barLevel: 1,
    wcLevel: 1,
    nextCrateId: 1,
    nextAgentId: 1,
    nextDisputeId: 1,
    lastEvent: template === 'SMALL' ? 'Kleine Bude eröffnet. Ein Automat steht gratis.' : 'Neues Haus eröffnet.',
    guardsHired: 0,
  };
}

/** Nach dem Laden: ein Casino ohne Spielgeraet bekommt seinen Gratis-Startautomaten zurueck. */
export function ensureStarter(world: WorldState): void {
  if (world.furniture.some((item) => item.gameId)) return;
  const def = getBuildDef('SLOT');
  world.furniture.push({
    id: world.nextFurnitureId++, kind: 'SLOT', gameId: 'SLOT', x: 16, y: 6, w: def.w, h: def.h, seats: def.seats,
    label: def.name, price: fromVC(0), quality: def.quality, condition: 100, damaged: false, dirt: 0,
    stock: 0, clog: 0, clogged: false,
    zoneId: 'gaming', occupants: [], mods: [], reels: 3, baseBet: def.baseBet,
  });
}
