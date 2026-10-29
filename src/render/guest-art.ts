/** South-Park-nahe Cutout-Figur: Kopf, Körper, Arme, Beine, Stimmung, Sprechblase. */
import { Container, Graphics, Text } from 'pixi.js';

const PERSONA_COLORS: Record<string, number> = {
  LUMPEN: 0x8d99ae, STREET: 0x00c9a7, STAMMGAST: 0xb06bff, BUSINESS: 0xd6a84b, HIGH_ROLLER: 0xff2e88,
};

export interface GuestArt {
  readonly root: Container;
  readonly say: (text: string) => void;
  readonly setMood: (mood: number, angry: boolean) => void;
}

export function createGuestArt(persona: string, name: string, isPlayer = false): GuestArt {
  const root = new Container();
  const color = isPlayer ? 0x00ffcc : PERSONA_COLORS[persona] ?? 0x9a86b8;
  const shadow = new Graphics().ellipse(0, 13, 11, 3.5).fill({ color: 0x000000, alpha: 0.4 });
  const legs = new Graphics();
  legs.roundRect(-6, 5, 4, 8, 1).fill(0x22162e);
  legs.roundRect(2, 5, 4, 8, 1).fill(0x22162e);
  const body = new Graphics();
  body.roundRect(-8, -13, 16, 20, 5).fill(color);
  body.roundRect(-11, -10, 3, 12, 2).fill(color);
  body.roundRect(8, -10, 3, 12, 2).fill(color);
  body.rect(-2, -13, 4, 20).fill({ color: 0xffffff, alpha: 0.16 });
  body.circle(0, 0, 2).fill({ color: 0x000000, alpha: 0.18 });
  const head = new Graphics();
  head.circle(0, -24, 9).fill(0xe6c3a0);
  head.circle(-3, -26, 1.2).fill(0x171020);
  head.circle(3, -26, 1.2).fill(0x171020);
  const hair = new Graphics();
  if (persona === 'BUSINESS' || persona === 'HIGH_ROLLER') {
    hair.roundRect(-9, -34, 18, 3, 1).fill(0x1a1020);
    hair.rect(-4, -32, 8, 2).fill(color);
  } else if (persona === 'STAMMGAST') {
    hair.circle(0, -33, 5).fill(0x3a2440);
  } else {
    hair.roundRect(-8, -33, 16, 4, 2).fill(0x2a1c3a);
  }
  const face = new Graphics();
  const bubbleBg = new Graphics();
  const bubble = new Text({
    text: '',
    style: {
      fontFamily: 'ui-monospace, monospace', fontSize: 8, fill: 0x1a1020,
      wordWrap: true, wordWrapWidth: 112, align: 'center',
    },
  });
  bubble.anchor.set(0.5, 1);
  bubble.position.set(0, -48);
  const nameplate = new Text({
    text: isPlayer ? 'DU' : name,
    style: { fontFamily: 'ui-monospace, monospace', fontSize: 7, fill: 0xcdbfd9, stroke: { color: 0x08040f, width: 2 } },
  });
  nameplate.anchor.set(0.5, 0);
  nameplate.position.set(0, 17);
  const emotionBg = new Graphics();
  const emotion = new Text({
    text: '',
    style: { fontFamily: 'ui-monospace, monospace', fontSize: 11, fill: 0x1a1020, fontWeight: 'bold' },
  });
  emotion.anchor.set(0.5, 0.5);
  emotionBg.position.set(15, -36);
  emotion.position.set(15, -36);
  root.addChild(shadow, legs, body, head, hair, face, nameplate, emotionBg, emotion, bubbleBg, bubble);

  const say = (text: string): void => {
    bubble.text = text;
    bubble.visible = text.length > 0;
    bubbleBg.clear();
    bubbleBg.visible = bubble.visible;
    if (!bubble.visible) return;
    const width = Math.min(126, Math.max(38, text.length * 4.6 + 12));
    const height = text.length > 24 ? 28 : 18;
    bubbleBg.roundRect(-width / 2, -48 - height, width, height, 6)
      .fill({ color: 0xf8f2e8, alpha: 0.96 })
      .stroke({ width: 1.2, color: 0x1a1020, alpha: 0.85 });
    bubbleBg.poly([-4, -48, 4, -48, 0, -42]).fill(0xf8f2e8);
    bubble.style.wordWrapWidth = width - 8;
    bubble.position.y = -48 - (height - 13);
  };

  return {
    root,
    say,
    setMood: (mood, angry) => {
      face.clear();
      emotionBg.clear();
      if (angry || mood < 25) {
        face.moveTo(-4, -21).lineTo(-1, -23).stroke({ width: 1.2, color: 0x8a2030 });
        face.moveTo(4, -21).lineTo(1, -23).stroke({ width: 1.2, color: 0x8a2030 });
        face.rect(-3, -18, 6, 2).fill(0x5a1826);
        emotion.text = '!';
        emotionBg.circle(15, -36, 7).fill(0xff6b81).stroke({ width: 1, color: 0x1a1020 });
      } else if (mood > 70) {
        face.moveTo(-5, -20).quadraticCurveTo(0, -16, 5, -20).stroke({ width: 1.4, color: 0x7a3040 });
        emotion.text = '♥';
        emotionBg.circle(15, -36, 6).fill(0xff9fc4).stroke({ width: 1, color: 0x1a1020 });
      } else if (mood < 45) {
        face.moveTo(-5, -19).quadraticCurveTo(0, -22, 5, -19).stroke({ width: 1.2, color: 0x7a3040 });
        emotion.text = '…';
        emotionBg.circle(15, -36, 6).fill(0x9ab8e0).stroke({ width: 1, color: 0x1a1020 });
      } else {
        face.rect(-3, -19, 6, 1.2).fill(0x7a3040);
        emotion.text = '';
      }
      emotion.visible = emotion.text.length > 0;
    },
  };
}
