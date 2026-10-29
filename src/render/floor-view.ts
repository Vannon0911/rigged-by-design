// @loc-exception: Eine Pixi-Buehne mit Kamera, Figuren, Möbeln und Input bleibt als eine zusammenhaengende Darstellungsdatei am lesbarsten.
/** Pixi-Floor: Übersicht, Zoom, Figuren, Möbel, Sprechblasen. Liest nur Snapshots. */
import { Application, Container, Graphics, Rectangle, Text, type FederatedPointerEvent } from 'pixi.js';
import { TILE } from '../core/sim/types';
import type { GameView } from '../store/types';
import { createFurnitureArt, type FurnitureArt } from './furniture-art';
import { createGuestArt, type GuestArt } from './guest-art';
import { drawDirt, drawFloor, drawZoneLabels } from './room-art';

export interface FloorCallbacks {
  readonly onGuest: (id: number) => void;
  readonly onFurniture: (id: number) => void;
  readonly onEmpty: (x: number, y: number) => void;
}

export class FloorView {
  readonly #app: Application;
  readonly #callbacks: FloorCallbacks;
  readonly #camera = new Container();
  readonly #base = new Graphics();
  readonly #dirt = new Graphics();
  readonly #furniture = new Container();
  readonly #guests = new Container();
  readonly #player: GuestArt;
  readonly #labels: Text[] = [];
  readonly #furnitureArt = new Map<number, FurnitureArt>();
  readonly #guestArt = new Map<number, GuestArt>();
  #view: GameView;
  #zoom = 1;
  #fit = 1;
  #focus = { x: 0.5, y: 0.5 };
  #follow = false;
  #destroyed = false;

  constructor(app: Application, view: GameView, callbacks: FloorCallbacks) {
    this.#app = app;
    this.#view = view;
    this.#callbacks = callbacks;
    for (let i = 0; i < 10; i += 1) {
      this.#labels.push(new Text({
        text: '', style: { fontFamily: 'ui-monospace, monospace', fontSize: 9, fill: 0xd9cdf0, letterSpacing: 2 },
      }));
    }
    this.#player = createGuestArt('STREET', 'DU', true);
    this.#camera.addChild(this.#base, this.#dirt, ...this.#labels, this.#furniture, this.#guests, this.#player.root);
    this.#camera.eventMode = 'static';
    this.#camera.on('pointertap', this.#tap);
    app.stage.addChild(this.#camera);
    app.canvas.addEventListener('wheel', this.#wheel, { passive: false });
    app.ticker.add(this.#animate);
    this.update(view, true);
  }

  update(view: GameView, force = false): void {
    if (this.#destroyed) return;
    const changed = force || view.size !== this.#view.size || view.template !== this.#view.template || view.carpet !== this.#view.carpet;
    this.#view = view;
    if (changed) this.#rebuild();
    drawFloor(this.#base, view, TILE);
    drawDirt(this.#dirt, view, TILE);
    drawZoneLabels(this.#labels, view, TILE);
    this.#syncFurniture();
    this.#syncGuests();
    this.#player.root.position.set((view.player.position.x + 0.5) * TILE, (view.player.position.y + 0.8) * TILE);
    this.#player.say(view.player.carrying === 'DRINK' ? 'DRINK' : '');
    this.#camera.hitArea = new Rectangle(0, 0, view.size * TILE, view.size * TILE);
    this.#applyCamera();
  }

  fit(): void {
    this.#zoom = this.#fit;
    this.#focus = { x: 0.5, y: 0.5 };
    this.#follow = false;
    this.#applyCamera();
  }

  zoomIn(): void {
    this.#follow = true;
    this.#zoom = Math.min(this.#fit * 4, this.#zoom * 1.6);
    this.#focus = { x: (this.#view.player.position.x + 0.5) / this.#view.size, y: (this.#view.player.position.y + 0.5) / this.#view.size };
    this.#applyCamera();
  }

  zoomOut(): void {
    this.#zoom = Math.max(this.#fit, this.#zoom / 1.6);
    this.#applyCamera();
  }

  zoomToZone(zoneId: string): void {
    const zone = this.#view.zones.find((entry) => entry.id === zoneId);
    if (!zone) return;
    this.#follow = false;
    this.#focus = { x: (zone.x + zone.w / 2) / this.#view.size, y: (zone.y + zone.h / 2) / this.#view.size };
    this.#zoom = Math.min(this.#fit * 4, Math.max(this.#zoom, this.#fit * 2.2));
    this.#applyCamera();
  }

  cellAt(clientX: number, clientY: number): { x: number; y: number } | null {
    const rect = this.#app.canvas.getBoundingClientRect();
    if (rect.width === 0) return null;
    const scale = rect.width / this.#app.screen.width;
    const localX = (clientX - rect.left) / scale;
    const localY = (clientY - rect.top) / scale;
    const x = Math.floor((localX - this.#camera.x) / this.#camera.scale.x / TILE);
    const y = Math.floor((localY - this.#camera.y) / this.#camera.scale.y / TILE);
    if (x < 0 || y < 0 || x >= this.#view.size || y >= this.#view.size) return null;
    return { x, y };
  }

  destroy(): void {
    this.#destroyed = true;
    this.#app.ticker.remove(this.#animate);
    this.#app.canvas.removeEventListener('wheel', this.#wheel);
    this.#camera.destroy({ children: true });
  }

  #rebuild(): void {
    const width = this.#view.size * TILE;
    this.#fit = Math.min(this.#app.screen.width / width, this.#app.screen.height / width) * 0.96;
    this.#fit = Math.max(0.04, this.#fit);
    this.#zoom = this.#fit;
    this.#focus = { x: 0.5, y: 0.5 };
    this.#follow = false;
    for (const art of this.#furnitureArt.values()) art.root.destroy({ children: true });
    for (const art of this.#guestArt.values()) art.root.destroy({ children: true });
    this.#furnitureArt.clear();
    this.#guestArt.clear();
    this.#furniture.removeChildren();
    this.#guests.removeChildren();
    this.#applyCamera();
  }

  #syncFurniture(): void {
    const alive = new Set(this.#view.furniture.map((item) => item.id));
    for (const [id, art] of this.#furnitureArt) {
      if (!alive.has(id)) { art.root.destroy({ children: true }); this.#furnitureArt.delete(id); }
    }
    for (const item of this.#view.furniture) {
      let art = this.#furnitureArt.get(item.id);
      if (!art) {
        art = createFurnitureArt(item, TILE);
        this.#furnitureArt.set(item.id, art);
        this.#furniture.addChild(art.root);
      }
      art.root.position.set(item.x * TILE, item.y * TILE);
      art.refresh(item);
      const guest = this.#view.guests.find((entry) => entry.targetFurniture === item.id && entry.lastResult);
      if (guest && this.#zoom > this.#fit * 1.25) art.setResult(guest.lastResult);
      else if (!guest) art.setResult(item.gameId ? 'BEREIT' : '');
    }
  }

  #syncGuests(): void {
    const alive = new Set(this.#view.guests.map((guest) => guest.id));
    for (const [id, art] of this.#guestArt) {
      if (!alive.has(id)) { art.root.destroy({ children: true }); this.#guestArt.delete(id); }
    }
    for (const guest of this.#view.guests) {
      let art = this.#guestArt.get(guest.id);
      if (!art) {
        art = createGuestArt(guest.persona, guest.name);
        this.#guestArt.set(guest.id, art);
        this.#guests.addChild(art.root);
      }
      art.say(guest.bubble);
      art.setMood(guest.mood, guest.state === 'ANGRY' || guest.anger > 50);
      art.root.alpha = guest.state === 'LEAVE' ? 0.45 : 0.72 + (guest.addiction / 100) * 0.28;
      const queue = guest.state === 'EXCHANGE' ? guest.queueIndex : 0;
      art.root.position.set((guest.position.x + 0.5) * TILE + queue * 4, (guest.position.y + 0.8) * TILE - queue * 9);
    }
  }

  #applyCamera(): void {
    const width = this.#view.size * TILE;
    const screen = this.#app.screen;
    const scale = Math.max(0.01, this.#zoom);
    this.#camera.scale.set(scale);
    this.#camera.position.set(
      screen.width / 2 - this.#focus.x * width * scale,
      screen.height / 2 - this.#focus.y * width * scale,
    );
    const detail = scale > this.#fit * 1.15;
    for (const label of this.#labels) label.visible = detail;
    for (const art of this.#guestArt.values()) art.root.visible = true;
  }

  #tap = (event: FederatedPointerEvent): void => {
    const point = event.getLocalPosition(this.#camera);
    const x = Math.floor(point.x / TILE);
    const y = Math.floor(point.y / TILE);
    if (x < 0 || y < 0 || x >= this.#view.size || y >= this.#view.size) return;
    const guest = this.#view.guests
      .map((entry) => ({ entry, distance: Math.abs(entry.position.x - x) + Math.abs(entry.position.y - y) }))
      .filter((entry) => entry.distance <= 1)
      .sort((a, b) => a.distance - b.distance)[0];
    if (guest) { this.#callbacks.onGuest(guest.entry.id); return; }
    const furniture = this.#view.furniture.find((item) =>
      x >= item.x && y >= item.y && x < item.x + item.w && y < item.y + item.h);
    if (furniture) { this.#callbacks.onFurniture(furniture.id); return; }
    this.#callbacks.onEmpty(x, y);
  };

  #wheel = (event: WheelEvent): void => {
    event.preventDefault();
    const rect = this.#app.canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    const scaleFactor = rect.width / this.#app.screen.width;
    const localX = (event.clientX - rect.left) / scaleFactor;
    const localY = (event.clientY - rect.top) / scaleFactor;
    const worldX = (localX - this.#camera.x) / this.#camera.scale.x / (this.#view.size * TILE);
    const worldY = (localY - this.#camera.y) / this.#camera.scale.y / (this.#view.size * TILE);
    this.#zoom = Math.min(this.#fit * 4.2, Math.max(this.#fit, this.#zoom * (event.deltaY < 0 ? 1.14 : 0.88)));
    this.#focus = { x: Math.max(0, Math.min(1, worldX)), y: Math.max(0, Math.min(1, worldY)) };
    this.#follow = false;
    this.#applyCamera();
  };

  #animate = (): void => {
    if (this.#destroyed) return;
    const now = performance.now();
    this.#view.guests.forEach((guest, index) => {
      const art = this.#guestArt.get(guest.id);
      if (!art) return;
      const queue = guest.state === 'EXCHANGE' ? guest.queueIndex : 0;
      const tx = (guest.position.x + 0.5) * TILE + queue * 4;
      const ty = (guest.position.y + 0.8) * TILE - queue * 9;
      art.root.x += (tx - art.root.x) * 0.22;
      art.root.y += (ty - art.root.y) * 0.22 + Math.sin(now / 280 + index) * 0.3;
    });
    const px = (this.#view.player.position.x + 0.5) * TILE;
    const py = (this.#view.player.position.y + 0.8) * TILE;
    this.#player.root.x += (px - this.#player.root.x) * 0.3;
    this.#player.root.y += (py - this.#player.root.y) * 0.3;
    if (this.#follow) {
      this.#focus = { x: (this.#view.player.position.x + 0.5) / this.#view.size, y: (this.#view.player.position.y + 0.5) / this.#view.size };
      this.#applyCamera();
    }
  };
}
