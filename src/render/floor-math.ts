/** Reine Floor-Mathe: Regions-Hash, Invalidierung, LOD, Culling, Koordinaten. Kein Pixi. */
import type { Area } from '../core/sim/grid-zones';
import { TILE } from '../core/sim/types';

interface RegionView {
  readonly size: number;
  readonly template: string;
  readonly carpet: string;
  readonly zones: readonly { id: string; kind: string; x: number; y: number; w: number; h: number; color: number }[];
}

const mix = (hash: number, value: number): number => Math.imul(hash ^ value, 16777619);

function zoneKey(zone: RegionView['zones'][number]): number {
  let hash = 2166136261;
  hash = mix(hash, zone.x);
  hash = mix(hash, zone.y);
  hash = mix(hash, zone.w);
  hash = mix(hash, zone.h);
  hash = mix(hash, zone.color);
  for (let index = 0; index < zone.id.length; index += 1) hash = mix(hash, zone.id.charCodeAt(index));
  return hash | 0;
}

/** Nur Bodenstruktur: Möbel stehen auf einer eigenen Ebene und backen den Boden nicht neu. */
export function regionHash(view: RegionView, area: Area): number {
  let hash = 2166136261;
  hash = mix(hash, view.size);
  for (let index = 0; index < view.template.length; index += 1) hash = mix(hash, view.template.charCodeAt(index));
  for (let index = 0; index < view.carpet.length; index += 1) hash = mix(hash, view.carpet.charCodeAt(index));
  hash = mix(hash, area.index);
  for (const zone of view.zones) {
    if (zone.x >= area.x + area.w || zone.y >= area.y + area.h || zone.x + zone.w <= area.x || zone.y + zone.h <= area.y) {
      continue;
    }
    hash = mix(hash, zoneKey(zone));
  }
  return hash | 0;
}

/** Welche 30×30-Bereiche seit dem letzten Stand neu gebacken werden müssen. */
export function changedRegions(view: RegionView, areas: readonly Area[], prev: ReadonlyMap<string, number>): string[] {
  const changed: string[] = [];
  for (const area of areas) {
    if (prev.get(area.id) !== regionHash(view, area)) changed.push(area.id);
  }
  return changed;
}

export interface ViewRect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** Sichtbares Welt-Rechteck in Pixeln aus Kamera-Transform und Bildschirm. */
export function visibleRect(cameraX: number, cameraY: number, scale: number, screenW: number, screenH: number): ViewRect {
  return {
    left: -cameraX / scale,
    top: -cameraY / scale,
    right: (screenW - cameraX) / scale,
    bottom: (screenH - cameraY) / scale,
  };
}

/** Teilweise sichtbare Objekte bleiben an; der Rand gibt Figuren Luft. */
export function isVisible(x: number, y: number, w: number, h: number, rect: ViewRect, margin: number): boolean {
  return x + w + margin >= rect.left && x - margin <= rect.right && y + h + margin >= rect.top && y - margin <= rect.bottom;
}

/** Detail erst oberhalb der Schwelle: gleiche Regel wie die Kamera. */
export function lodFor(zoom: number, fit: number): boolean {
  return zoom > fit * 1.12;
}

interface ClientRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
}

/** Bildschirmpixel zu Tile; außerhalb des Floors null. */
export function screenToTile(
  clientX: number, clientY: number, rect: ClientRect, screenW: number,
  cameraX: number, cameraY: number, scale: number, size: number, tile = TILE,
): { x: number; y: number } | null {
  if (rect.width === 0) return null;
  const factor = rect.width / screenW;
  const x = Math.floor(((clientX - rect.left) / factor - cameraX) / scale / tile);
  const y = Math.floor(((clientY - rect.top) / factor - cameraY) / scale / tile);
  if (x < 0 || y < 0 || x >= size || y >= size) return null;
  return { x, y };
}
