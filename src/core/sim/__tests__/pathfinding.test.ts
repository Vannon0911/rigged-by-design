/**
 * @test-target: src/core/sim/pathfinding.ts
 * @error-code: ERR-2001
 *
 * Der Heap-A* liefert weiterhin kuerzeste, zusammenhaengende Wege; der Nav-Cache
 * bleibt bei Umbauten korrekt.
 */
import { describe, expect, it } from 'vitest';
import { blockedTiles, findPath, isWalkable, nearestWalkable } from '../pathfinding';
import type { Furniture, Point } from '../types';

const SIZE = 30;

function blocker(id: number, x: number, y: number, w = 1, h = 1): Furniture {
  return {
    id, kind: 'SLOT', x, y, w, h, seats: 1, label: 'Block', price: 0 as never, quality: 1,
    condition: 100, damaged: false, dirt: 0, stock: 0, clog: 0, clogged: false, zoneId: 'gaming',
    occupants: [], mods: [], reels: 3, baseBet: 0 as never,
  };
}

const steps = (path: readonly Point[]): number => Math.max(0, path.length - 1);

function contiguous(path: readonly Point[]): boolean {
  return path.every((point, index) => {
    if (index === 0) return true;
    const previous = path[index - 1]!;
    return Math.abs(previous.x - point.x) + Math.abs(previous.y - point.y) === 1;
  });
}

describe('A*', () => {
  it('findet den kuerzesten Weg im offenen Feld', () => {
    const blocked = blockedTiles(SIZE, []);
    const path = findPath(SIZE, blocked, { x: 2, y: 2 }, { x: 10, y: 7 });
    expect(path.at(-1)).toEqual({ x: 10, y: 7 });
    expect(steps(path)).toBe(8 + 5);
    expect(contiguous(path)).toBe(true);
  });

  it('geht um Hindernisse herum statt hindurch', () => {
    const wall = Array.from({ length: 20 }, (_, index) => blocker(100 + index, 15, 2 + index));
    const blocked = blockedTiles(SIZE, wall);
    const path = findPath(SIZE, blocked, { x: 10, y: 10 }, { x: 20, y: 10 });
    expect(blocked.has(15 + 10 * SIZE)).toBe(true);
    expect(path.some((point) => point.x === 15 && point.y >= 2 && point.y < 22)).toBe(false);
    expect(contiguous(path)).toBe(true);
    expect(path.at(-1)).toEqual({ x: 20, y: 10 });
  });

  it('meldet ein eingemauertes Ziel als unerreichbar', () => {
    const trap = [blocker(1, 11, 9), blocker(2, 11, 11), blocker(3, 10, 10), blocker(4, 12, 10)];
    const blocked = blockedTiles(SIZE, trap);
    expect(findPath(SIZE, blocked, { x: 2, y: 2 }, { x: 11, y: 10 })).toEqual([]);
  });

  it('gibt das Ziel selbst zurueck, wenn Start und Ziel gleich sind', () => {
    const blocked = blockedTiles(SIZE, []);
    expect(findPath(SIZE, blocked, { x: 5, y: 5 }, { x: 5, y: 5 })).toEqual([{ x: 5, y: 5 }]);
  });
});

describe('Navigations-Cache', () => {
  it('liefert dasselbe Raster erneut, solange der Aufbau gleich bleibt', () => {
    const furniture = [blocker(1, 5, 5)];
    const first = blockedTiles(SIZE, furniture);
    const second = blockedTiles(SIZE, furniture);
    expect(second).toBe(first);
    expect(first.has(5 + 5 * SIZE)).toBe(true);
  });

  it('verwirft das Raster, sobald ein Moebel dazukommt oder wandert', () => {
    const furniture = [blocker(1, 5, 5)];
    blockedTiles(SIZE, furniture);
    furniture.push(blocker(2, 7, 7));
    const grown = blockedTiles(SIZE, furniture);
    expect(grown.has(7 + 7 * SIZE)).toBe(true);

    const moved = [blocker(1, 9, 9)];
    const shifted = blockedTiles(SIZE, moved);
    expect(shifted.has(9 + 9 * SIZE)).toBe(true);
    expect(shifted.has(5 + 5 * SIZE)).toBe(false);
  });

  it('faellt bei anderer Brettgroesse nicht auf den alten Cache herein', () => {
    blockedTiles(SIZE, []);
    const large = blockedTiles(60, []);
    expect(isWalkable(60, large, 45, 45)).toBe(true);
    expect(large.has(59)).toBe(true);
  });
});

describe('nearestWalkable', () => {
  it('findet das naechste freie Tile in Ringen von innen nach aussen', () => {
    const blocked = blockedTiles(SIZE, [blocker(1, 5, 5)]);
    const found = nearestWalkable(SIZE, blocked, { x: 5, y: 5 });
    expect(found).not.toBeNull();
    expect(isWalkable(SIZE, blocked, found!.x, found!.y)).toBe(true);
    // Ein Diagonalschritt ist auf dem 4er-Grid zwei Schritte entfernt.
    expect(Math.abs(found!.x - 5) + Math.abs(found!.y - 5)).toBeLessThanOrEqual(2);
  });

  it('gibt das Startfeld zurueck, wenn es frei ist', () => {
    const blocked = blockedTiles(SIZE, []);
    expect(nearestWalkable(SIZE, blocked, { x: 4, y: 4 })).toEqual({ x: 4, y: 4 });
  });
});
