/** Grid-Geometrie: freie Zelle finden, Zellen validieren. */
import type { PlacedItem } from './types';

export function freeCell(items: readonly PlacedItem[], size: number): { x: number; y: number } | null {
  const used = new Set(items.map((item) => `${item.x},${item.y}`));
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (!used.has(`${x},${y}`)) return { x, y };
    }
  }
  return null;
}

export function assertCell(
  items: readonly PlacedItem[],
  size: number,
  x: number,
  y: number,
  ignoreId?: number,
): void {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= size || y >= size) {
    throw new Error(`(${x}, ${y}) liegt außerhalb des ${size}×${size}-Grids.`);
  }
  if (items.some((item) => item.x === x && item.y === y && item.id !== ignoreId)) {
    throw new Error(`(${x}, ${y}) ist belegt.`);
  }
}
