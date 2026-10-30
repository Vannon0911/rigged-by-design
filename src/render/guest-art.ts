// @loc-exception: Figur, Gesicht, Outfit und Sticker teilen dieselbe Paper-Doll-Silhouette; getrennt waeren die Mood-Wechsel unsichtbar.
/** South-Park-Paper-Doll: großer ovaler Kopf, enge Augen, Stummelkörper, Hut und Comic-Sticker. */
import { Container, Graphics, Text } from 'pixi.js';
import type { GuestEmotion } from '../core/sim/emotion';
import { createComicBubble } from './comic-bubbles';

const PERSONA_COLORS: Record<string, number> = {
  LUMPEN: 0x8d99ae, STREET: 0x00c9a7, STAMMGAST: 0xb06bff, BUSINESS: 0xd6a84b, HIGH_ROLLER: 0xff2e88,
};
const SKINS = [0xf2d3b3, 0xe0b48c, 0xb97c4b, 0x8a5a36, 0xd8a27a];
const HAIRS = [0x2a1a14, 0x5a3a22, 0xd9b35c, 0x1a1020, 0x9a5a2a];
type FaceKind = 'angry' | 'greedy' | 'happy' | 'meh' | 'neutral';

export interface GuestArt {
  readonly root: Container;
  readonly sticker: Container;
  readonly from: { x: number; y: number };
  readonly target: { x: number; y: number };
  moveStart: number;
  readonly phase: number;
  readonly setEmotion: (kind: GuestEmotion) => void;
  readonly setMood: (mood: number, angry: boolean, addiction: number) => void;
  readonly setPersona: (persona: string) => void;
  readonly setName: (name: string) => void;
  readonly setLod: (detail: boolean) => void;
}

const hash = (value: string): number => {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) result = (result * 31 + value.charCodeAt(index)) | 0;
  return Math.abs(result);
};

export function createGuestArt(persona: string, name: string, isPlayer = false, phase = 0): GuestArt {
  const seed = hash(name || persona);
  const skinColor = isPlayer ? 0xf2d3b3 : SKINS[seed % SKINS.length]!;
  const hairColor = HAIRS[(seed >> 3) % HAIRS.length]!;
  const root = new Container();
  const figure = new Container();
  const shadow = new Graphics().ellipse(0, 14, 12, 3.5).fill({ color: 0x000000, alpha: 0.42 });
  const legs = new Graphics();
  legs.roundRect(-7, 4, 5, 10, 2).fill(0x1c1226);
  legs.roundRect(2, 4, 5, 10, 2).fill(0x1c1226);
  legs.roundRect(-8, 12, 6, 3, 1.5).fill(0x0c0814);
  legs.roundRect(2, 12, 6, 3, 1.5).fill(0x0c0814);
  const body = new Graphics();
  const head = new Graphics();
  head.ellipse(0, -28, 11.5, 12.5).fill(skinColor).stroke({ width: 1, color: 0x1a1020, alpha: 0.55 });
  head.circle(-11, -27, 2.4).fill(skinColor);
  head.circle(11, -27, 2.4).fill(skinColor);
  const face = new Graphics();
  const hair = new Graphics();
  figure.addChild(shadow, legs, body, head, face, hair);
  const pin = new Graphics();
  pin.visible = false;
  const nameplate = new Text({
    text: isPlayer ? 'DU' : name,
    style: { fontFamily: 'ui-monospace, monospace', fontSize: 7, fill: 0xcdbfd9, stroke: { color: 0x08040f, width: 2 } },
  });
  nameplate.anchor.set(0.5, 0);
  nameplate.position.set(0, 17);
  root.addChild(pin, figure, nameplate);
  const sticker = new Container();
  const bubble = createComicBubble();
  sticker.addChild(bubble.container);
  sticker.visible = false;
  let currentPersona = '';
  let currentName = name;
  let currentMood = -1;
  let currentAngry = false;
  let currentAddiction = -1;
  let currentFace: FaceKind | '' = '';
  let currentEmotion: GuestEmotion = 'NONE';
  let detail = true;

  const paintPin = (color: number): void => {
    pin.clear();
    pin.roundRect(-3.5, 0, 7, 7, 2).fill(color);
    pin.circle(0, -5, 4.5).fill(skinColor).stroke({ width: 1, color: 0x1a1020 });
    pin.circle(-1.5, -5.5, 0.9).fill(0x1a1020);
    pin.circle(1.5, -5.5, 0.9).fill(0x1a1020);
    if (isPlayer) pin.circle(0, -2, 10).stroke({ width: 1.5, color: 0xffffff, alpha: 0.95 });
  };

  const paintBody = (color: number): void => {
    body.clear();
    body.poly([-10, -14, 10, -14, 7, 7, -7, 7]).fill(color).stroke({ width: 1, color: 0x1a1020, alpha: 0.5 });
    body.roundRect(-13, -13, 4, 12, 2).fill(color);
    body.roundRect(9, -13, 4, 12, 2).fill(color);
    body.circle(-13, -1, 2.6).fill(skinColor);
    body.circle(13, -1, 2.6).fill(skinColor);
    body.poly([-5, -14, 0, -8, 5, -14]).fill({ color: 0xffffff, alpha: 0.22 });
    if (currentPersona === 'BUSINESS' || currentPersona === 'HIGH_ROLLER') {
      body.poly([-2, -14, 2, -14, 3, -3, 0, 1, -3, -3]).fill(0x1a1020);
    } else if (currentPersona === 'STREET') {
      body.rect(-6, -9, 12, 1.5).fill({ color: 0xffffff, alpha: 0.28 });
      body.circle(0, -3, 2.4).fill({ color: 0x1a1020, alpha: 0.2 });
    } else if (currentPersona === 'LUMPEN') {
      body.rect(-7, 3, 14, 1.5).fill({ color: 0x1a1020, alpha: 0.4 });
    }
  };

  const paintHair = (): void => {
    hair.clear();
    if (currentPersona === 'BUSINESS') {
      hair.poly([-11, -34, 11, -34, 10, -39, 1, -42, -4, -38]).fill(hairColor);
      hair.rect(-3, -40, 5, 4).fill(hairColor);
    } else if (currentPersona === 'HIGH_ROLLER') {
      hair.roundRect(-8, -49, 16, 12, 2).fill(0x16101e).stroke({ width: 1, color: 0xffd166 });
      hair.roundRect(-14, -38, 28, 3, 1).fill(0x16101e).stroke({ width: 1, color: 0xffd166 });
      hair.rect(-8, -47, 16, 2).fill(0xff2e88);
    } else if (currentPersona === 'STAMMGAST') {
      hair.roundRect(-11, -40, 22, 7, 4).fill(0x6a3f8a);
      hair.roundRect(-9, -35, 18, 2, 1).fill(0x8a5fae);
    } else if (currentPersona === 'STREET') {
      hair.poly([-11, -34, -6, -41, 0, -36, 5, -42, 11, -34]).fill(hairColor);
    } else {
      hair.roundRect(-11, -38, 22, 5, 3).fill(0x3a2440);
      hair.rect(-8, -34, 16, 2).fill(0x2a1a30);
    }
    if (isPlayer) {
      hair.roundRect(-12, -41, 24, 5, 3).fill(0x00ffcc);
      hair.roundRect(-12, -36, 24, 2, 1).fill(0xffffff);
    }
  };

  const paintFace = (kind: FaceKind): void => {
    face.clear();
    const wide = kind === 'greedy' ? 4.2 : 3.6;
    const high = kind === 'greedy' ? 5.1 : 4.4;
    face.ellipse(-4.2, -29, wide, high).fill(0xffffff).stroke({ width: 0.8, color: 0x2a1a20 });
    face.ellipse(4.2, -29, wide, high).fill(0xffffff).stroke({ width: 0.8, color: 0x2a1a20 });
    const pupil = kind === 'angry' ? 1.2 : kind === 'greedy' ? 1 : 1.5;
    face.circle(-4.2, -29, pupil).fill(0x171020);
    face.circle(4.2, -29, pupil).fill(0x171020);
    if (currentPersona === 'HIGH_ROLLER') {
      face.roundRect(-9, -32, 18, 4.5, 1).fill(0x0a0812).stroke({ width: 1, color: 0xffd166 });
      face.rect(-1, -32, 1.5, 4.5).fill(0xffd166);
    }
    if (kind === 'angry') {
      face.moveTo(-9, -35).lineTo(-1, -31).stroke({ width: 1.8, color: 0x1a1020 });
      face.moveTo(9, -35).lineTo(1, -31).stroke({ width: 1.8, color: 0x1a1020 });
      face.roundRect(-3.5, -19, 7, 2, 1).fill(0x4a1420);
      face.moveTo(-3, -18).lineTo(-1, -16).lineTo(1, -18).stroke({ width: 1, color: 0xffffff });
    } else if (kind === 'greedy') {
      face.moveTo(-8, -34).lineTo(-1, -36).stroke({ width: 1.1, color: 0x1a1020 });
      face.moveTo(8, -34).lineTo(1, -36).stroke({ width: 1.1, color: 0x1a1020 });
      face.ellipse(0, -18, 3, 2.2).fill(0x4a1420);
      face.circle(1.5, -18, 1).fill(0xff6b81);
    } else if (kind === 'happy') {
      face.moveTo(-6, -20).quadraticCurveTo(0, -15, 6, -20).stroke({ width: 1.5, color: 0x6a2030 });
      face.circle(-4.5, -30, 0.6).fill(0xffffff);
      face.circle(3.9, -30, 0.6).fill(0xffffff);
    } else if (kind === 'meh') {
      face.rect(-8, -33, 16, 4).fill(skinColor);
      face.moveTo(-4, -19).lineTo(4, -19).stroke({ width: 1.3, color: 0x5a2030 });
    } else {
      face.moveTo(-5, -20).quadraticCurveTo(0, -18, 5, -20).stroke({ width: 1.2, color: 0x6a2030 });
    }
  };

  const setPersona = (next: string): void => {
    if (next === currentPersona) return;
    currentPersona = next;
    const color = isPlayer ? 0x00ffcc : PERSONA_COLORS[next] ?? 0x9a86b8;
    paintBody(color);
    paintHair();
    paintPin(color);
    currentFace = '';
    if (currentMood >= 0) setMood(currentMood, currentAngry, currentAddiction);
  };

  const setMood = (mood: number, angry: boolean, addiction: number): void => {
    const kind: FaceKind = angry || mood < 25 ? 'angry' : addiction >= 60 && mood >= 40 ? 'greedy'
      : mood > 70 ? 'happy' : mood < 45 ? 'meh' : 'neutral';
    currentMood = mood;
    currentAngry = angry;
    currentAddiction = addiction;
    if (kind === currentFace) return;
    currentFace = kind;
    paintFace(kind);
  };

  const setEmotion = (kind: GuestEmotion): void => {
    currentEmotion = kind;
    bubble.set(kind);
    sticker.visible = detail && kind !== 'NONE';
  };

  const setLod = (next: boolean): void => {
    if (next === detail) return;
    detail = next;
    figure.visible = next;
    pin.visible = !next;
    nameplate.visible = next;
    sticker.visible = next && currentEmotion !== 'NONE';
    if (!next) bubble.container.visible = false;
    else { bubble.set(currentEmotion); bubble.container.visible = currentEmotion !== 'NONE'; }
  };

  const setName = (next: string): void => {
    if (next === currentName) return;
    currentName = next;
    nameplate.text = next.length > 16 ? `${next.slice(0, 15)}…` : next;
  };

  setPersona(persona);
  setMood(60, false, 0);
  setLod(true);
  setEmotion('NONE');

  return { root, sticker, from: { x: 0, y: 0 }, target: { x: 0, y: 0 }, moveStart: 0, phase, setEmotion, setMood, setPersona, setName, setLod };
}
