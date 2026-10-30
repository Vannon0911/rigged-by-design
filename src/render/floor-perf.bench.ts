/**
 * @test-target: src/render/floor-math.ts
 * @error-code: ERR-1003
 *
 * Worst-Case: 90×90-Floor, 9 Regionen, 500 Dreck-Tiles, 200 Entities.
 * Bewusst nicht Teil von verify:all: misst Geschwindigkeit, wird nie rot.
 */
import { test } from 'vitest';
import { Graphics } from 'pixi.js';
import { areasFor } from '../core/sim/grid-zones';
import { createWorld } from '../core/sim/templates';
import { isVisible, regionHash, visibleRect } from './floor-math';
import { drawRegionDirt, drawRegionFloor } from './room-art';

const world = createWorld('LARGE');
const areas = areasFor('LARGE');
const view = {
  size: world.size,
  template: world.template,
  carpet: world.carpet,
  zones: world.zones,
  furniture: [],
  dirtyTiles: new Set(Array.from({ length: 500 }, (_, index) => (index * 37) % (world.size * world.size))),
};
const rect = visibleRect(0, 0, 0.2, 1600, 900);

test('Floor-Durchsatz im Worst-Case', { timeout: 600_000 }, async ({ bench }) => {
  const hashes = await bench('9 Regions-Hashes', () => {
    for (const area of areas) regionHash(view as never, area);
  }).run();
  console.log(`hash: ${hashes.period.toFixed(4)} ms/op (9 Regionen)`);

  const floor = await bench('9 Boden-Chunks neu zeichnen', () => {
    for (const area of areas) {
      const g = new Graphics();
      drawRegionFloor(g, view as never, area, 26);
      g.destroy();
    }
  }).run();
  console.log(`boden: ${floor.period.toFixed(4)} ms/op (9 Chunks, 90x90)`);

  const dirt = await bench('Dreck in 9 Regionen', () => {
    for (const area of areas) {
      const g = new Graphics();
      drawRegionDirt(g, view as never, area, 26);
      g.destroy();
    }
  }).run();
  console.log(`dreck: ${dirt.period.toFixed(4)} ms/op (500 Tiles)`);

  const cull = await bench('Culling über 200 Entities', () => {
    for (let index = 0; index < 200; index += 1) {
      isVisible((index * 53) % 2340, (index * 91) % 2340, 26, 26, rect, 40);
    }
  }).run();
  console.log(`cull: ${cull.period.toFixed(4)} ms/op (200 Entities)`);
});
