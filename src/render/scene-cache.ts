/** Vier Render-Layer. Der Raum wird EINMAL als GPU-Textur gebacken, nicht pro Tick neu gezeichnet. */
import { Container, Graphics, Text } from 'pixi.js';
import { TILE } from '../core/sim/types';
import type { GameView } from '../store/types';
import { drawDirt, drawFloor } from './room-art';

const LABEL_COUNT = 10;

/** Struktur-Hash: nur neue Raeume kosten einen Redraw. */
export function roomHash(view: GameView): number {
  let hash = 2166136261;
  hash = Math.imul(hash ^ view.size, 16777619);
  hash = Math.imul(hash ^ view.template.charCodeAt(0), 16777619);
  hash = Math.imul(hash ^ view.carpet.charCodeAt(0), 16777619);
  hash = Math.imul(hash ^ view.zones.length, 16777619);
  for (const item of view.furniture) {
    hash = Math.imul(hash ^ item.id, 16777619);
    hash = Math.imul(hash ^ item.x, 16777619);
    hash = Math.imul(hash ^ item.y, 16777619);
    hash = Math.imul(hash ^ item.w, 16777619);
    hash = Math.imul(hash ^ item.h, 16777619);
  }
  return hash | 0;
}

export function dirtHash(view: GameView): number {
  if (view.dirtyTiles.length === 0) return 0;
  let hash = view.dirtyTiles.length;
  for (const tile of view.dirtyTiles) hash = (Math.imul(hash, 31) + tile) | 0;
  return hash;
}

export interface SceneCache {
  readonly room: Container;
  readonly furniture: Container;
  readonly actors: Container;
  readonly stickers: Container;
  readonly labels: readonly Text[];
  readonly dirt: Graphics;
  readonly redrawRoom: (view: GameView) => void;
  readonly redrawDirt: (view: GameView) => void;
  readonly setLabels: (view: GameView, detail: boolean) => void;
  readonly destroy: () => void;
}

export function createSceneCache(): SceneCache {
  const room = new Container();
  const floor = new Graphics();
  room.addChild(floor);

  const furniture = new Container();
  const dirt = new Graphics();
  furniture.addChild(dirt);

  const actors = new Container();
  const stickers = new Container();

  const labels: Text[] = [];
  for (let index = 0; index < LABEL_COUNT; index += 1) {
    const label = new Text({
      text: '',
      style: { fontFamily: 'ui-monospace, monospace', fontSize: 9, fill: 0xd9cdf0, letterSpacing: 2 },
    });
    label.visible = false;
    labels.push(label);
    furniture.addChild(label);
  }

  let cached = false;

  const redrawRoom = (view: GameView): void => {
    floor.clear();
    drawFloor(floor, view, TILE);
    if (!cached) {
      room.cacheAsTexture(true);
      cached = true;
    } else {
      room.updateCacheTexture();
    }
  };

  const redrawDirt = (view: GameView): void => {
    dirt.clear();
    drawDirt(dirt, view, TILE);
  };

  const setLabels = (view: GameView, detail: boolean): void => {
    view.zones.forEach((zone, index) => {
      const label = labels[index];
      if (!label) return;
      label.text = zone.name.toUpperCase();
      label.position.set(zone.x * TILE + 12, zone.y * TILE + 10);
      label.visible = detail;
    });
    for (let index = view.zones.length; index < labels.length; index += 1) labels[index]!.visible = false;
  };

  const destroy = (): void => {
    if (cached) room.cacheAsTexture(false);
    room.destroy({ children: true });
    furniture.destroy({ children: true });
    actors.destroy({ children: true });
    stickers.destroy({ children: true });
  };

  return { room, furniture, actors, stickers, labels, dirt, redrawRoom, redrawDirt, setLabels, destroy };
}
