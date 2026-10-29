/** A* auf dem Tile-Grid. Deterministisch, 4 Richtungen, mit Blockern. */
import type { Furniture, Point } from './types';

export function tileIndex(size: number, x: number, y: number): number {
  return y * size + x;
}

export function blockedTiles(size: number, furniture: readonly Furniture[]): Set<number> {
  const blocked = new Set<number>();
  for (let i = 0; i < size; i += 1) {
    blocked.add(tileIndex(size, i, 0));
    blocked.add(tileIndex(size, i, size - 1));
    blocked.add(tileIndex(size, 0, i));
    blocked.add(tileIndex(size, size - 1, i));
  }
  for (const item of furniture) {
    for (let y = item.y; y < item.y + item.h; y += 1) {
      for (let x = item.x; x < item.x + item.w; x += 1) {
        if (x >= 0 && y >= 0 && x < size && y < size) blocked.add(tileIndex(size, x, y));
      }
    }
  }
  return blocked;
}

export function isWalkable(size: number, blocked: Set<number>, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < size && y < size && !blocked.has(tileIndex(size, x, y));
}

export function neighbors(size: number, blocked: Set<number>, point: Point): Point[] {
  const result: Point[] = [];
  const steps = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;
  for (const [dx, dy] of steps) {
    const x = point.x + dx;
    const y = point.y + dy;
    if (isWalkable(size, blocked, x, y)) result.push({ x, y });
  }
  return result;
}

const key = (point: Point): string => `${point.x},${point.y}`;
const heuristic = (a: Point, b: Point): number => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/** Gibt den Weg inklusive Ziel zurueck; [] wenn unerreichbar. */
export function findPath(size: number, blocked: Set<number>, start: Point, goal: Point): Point[] {
  if (!isWalkable(size, blocked, goal.x, goal.y) || !isWalkable(size, blocked, start.x, start.y)) return [];
  const open: { point: Point; g: number; f: number }[] = [{ point: start, g: 0, f: heuristic(start, goal) }];
  const cameFrom = new Map<string, Point>();
  const best = new Map<string, number>([[key(start), 0]]);
  const closed = new Set<string>();

  while (open.length > 0) {
    open.sort((a, b) => a.f - b.f || a.g - b.g);
    const current = open.shift()!;
    const currentKey = key(current.point);
    if (currentKey === key(goal)) {
      const path: Point[] = [goal];
      let cursor: Point | undefined = goal;
      while (cursor && key(cursor) !== key(start)) {
        cursor = cameFrom.get(key(cursor));
        if (cursor) path.push(cursor);
      }
      return path.reverse();
    }
    if (closed.has(currentKey)) continue;
    closed.add(currentKey);

    for (const next of neighbors(size, blocked, current.point)) {
      const nextKey = key(next);
      const g = current.g + 1;
      if (g >= (best.get(nextKey) ?? Number.POSITIVE_INFINITY)) continue;
      best.set(nextKey, g);
      cameFrom.set(nextKey, current.point);
      open.push({ point: next, g, f: g + heuristic(next, goal) });
    }
  }
  return [];
}

/** Freies Tile vor einem Objekt; Reihenfolge unten, links, rechts, oben. */
export function approachPoint(size: number, blocked: Set<number>, item: Furniture): Point | null {
  const candidates: Point[] = [
    { x: item.x + Math.floor(item.w / 2), y: item.y + item.h },
    { x: item.x - 1, y: item.y + Math.floor(item.h / 2) },
    { x: item.x + item.w, y: item.y + Math.floor(item.h / 2) },
    { x: item.x + Math.floor(item.w / 2), y: item.y - 1 },
  ];
  return candidates.find((point) => isWalkable(size, blocked, point.x, point.y)) ?? null;
}

export function nearestWalkable(size: number, blocked: Set<number>, from: Point): Point | null {
  if (isWalkable(size, blocked, from.x, from.y)) return from;
  for (let radius = 1; radius < size; radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        const point = { x: from.x + dx, y: from.y + dy };
        if (isWalkable(size, blocked, point.x, point.y)) return point;
      }
    }
  }
  return null;
}
