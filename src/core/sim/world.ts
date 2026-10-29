/** Welt-Helfer: Zonen, Objekte, Reservierungen, freie Plaetze. */
import { blockedTiles, approachPoint, findPath, nearestWalkable } from './pathfinding';
import type { Furniture, Guest, Point, WorldState, Zone } from './types';

export function zoneOf(world: WorldState, point: Point): Zone | null {
  return world.zones.find((zone) =>
    point.x >= zone.x && point.y >= zone.y && point.x < zone.x + zone.w && point.y < zone.y + zone.h) ?? null;
}

export function zoneById(world: WorldState, id: string): Zone | null {
  return world.zones.find((zone) => zone.id === id) ?? null;
}

export function furnitureById(world: WorldState, id: number): Furniture | null {
  return world.furniture.find((item) => item.id === id) ?? null;
}

export function freeSeat(item: Furniture): boolean {
  return item.seats > item.occupants.length;
}

export function reserveSeat(world: WorldState, itemId: number, guestId: number): boolean {
  const item = furnitureById(world, itemId);
  if (!item || item.seats <= item.occupants.length || item.occupants.includes(guestId)) return false;
  item.occupants.push(guestId);
  return true;
}

export function releaseSeat(world: WorldState, itemId: number, guestId: number): void {
  const item = furnitureById(world, itemId);
  if (item) item.occupants = item.occupants.filter((id) => id !== guestId);
}

export function interactionPoint(world: WorldState, item: Furniture): Point | null {
  return approachPoint(world.size, blockedTiles(world.size, world.furniture), item);
}

export function pathTo(world: WorldState, from: Point, to: Point): Point[] {
  return findPath(world.size, blockedTiles(world.size, world.furniture), from, to);
}

export function spawnPoint(world: WorldState): Point {
  const entrance = world.zones.find((zone) => zone.kind === 'ENTRANCE') ?? world.zones[0]!;
  return nearestWalkable(world.size, blockedTiles(world.size, world.furniture), {
    x: entrance.x + 1,
    y: entrance.y + Math.floor(entrance.h / 2),
  }) ?? { x: entrance.x + 1, y: entrance.y + 1 };
}

export function exchangePoint(world: WorldState): Point | null {
  const desk = world.furniture.find((item) => item.kind === 'EXCHANGE');
  return desk ? interactionPoint(world, desk) : null;
}

export function freeFurniture(world: WorldState, kinds: readonly Furniture['kind'][]): Furniture | null {
  return world.furniture.find((item) => kinds.includes(item.kind) && freeSeat(item)) ?? null;
}

export function guestById(world: WorldState, id: number): Guest | null {
  return world.guests.find((guest) => guest.id === id) ?? null;
}

export function guestTargetPoint(world: WorldState, guest: Guest): Point | null {
  const item = furnitureById(world, guest.targetFurniture);
  if (item) return interactionPoint(world, item);
  const zone = zoneById(world, guest.targetZone);
  if (!zone) return null;
  return nearestWalkable(world.size, blockedTiles(world.size, world.furniture), {
    x: zone.x + Math.floor(zone.w / 2),
    y: zone.y + Math.floor(zone.h / 2),
  });
}

export function sendGuest(world: WorldState, guest: Guest, target: Point): void {
  guest.path = pathTo(world, guest.position, target);
  guest.pathIndex = 0;
}

export function canPlace(world: WorldState, x: number, y: number, w: number, h: number): boolean {
  if (x < 1 || y < 1 || x + w >= world.size - 1 || y + h >= world.size - 1) return false;
  return !world.furniture.some((item) =>
    x < item.x + item.w && x + w > item.x && y < item.y + item.h && y + h > item.y);
}
