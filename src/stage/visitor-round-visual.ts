/** Baut das symbolische Spiel-Popup eines Gastes: Slot, Becher, Wuerfel, Roulette oder Karten. */
import { Container, Graphics, Text } from 'pixi.js';
import type { FloorRoundVisual } from '../core/simulation/floor-events';

const SYMBOL_COLORS: Readonly<Record<string, number>> = {
  BLANK: 0x6f687f,
  CHERRY: 0xff0055,
  BELL: 0xffcc00,
  SEVEN: 0xff2e88,
  VACOIN_DIAMOND: 0x00ffcc,
  WILD: 0xa855f7,
};

export function roundHeadline(game: string, isNearMiss: boolean, isLDW: boolean, isWin: boolean): string {
  const result = isNearMiss ? 'NEAR MISS' : isLDW ? 'LDW' : isWin ? 'GEWINN' : 'VERLOREN';
  return `${game} · ${result}`;
}

function slotRow(visual: Extract<FloorRoundVisual, { kind: 'SLOT' }>): Container {
  const row = new Container();
  row.position.set(0, 3);
  for (let index = 0; index < 3; index += 1) {
    const symbol = visual.symbols[index] ?? 'BLANK';
    const color = SYMBOL_COLORS[symbol] ?? 0x8a97b0;
    const x = index * 22 - 32;
    const box = new Graphics()
      .roundRect(x, -9, 20, 18, 3)
      .fill(0x10101a)
      .stroke({ width: 1, color, alpha: 0.9 });
    const label = new Text({
      text: symbol === 'VACOIN_DIAMOND' ? 'DI' : symbol === 'BLANK' ? '·' : symbol === 'WILD' ? 'W' : symbol.slice(0, 2),
      style: { fontFamily: 'monospace', fontSize: 8, fontWeight: 'bold', fill: color },
    });
    label.anchor.set(0.5);
    label.position.set(x + 10, 0);
    row.addChild(box, label);
  }
  return row;
}

function shellRow(visual: Extract<FloorRoundVisual, { kind: 'SHELL' }>): Container {
  const row = new Container();
  row.position.set(0, 3);
  const count = Math.min(5, visual.cups);
  const start = -(count * 13) / 2 + 6.5;
  for (let index = 0; index < count; index += 1) {
    const cx = start + index * 13;
    const cup = new Graphics();
    cup.poly([cx - 6, 7, cx + 6, 7, cx, -5]).fill(0x8a5a32).stroke({ width: 1, color: 0xd4a24a });
    row.addChild(cup);
    if (visual.winning.includes(index)) row.addChild(new Graphics().circle(cx, 1, 2.2).fill(0xffd166));
  }
  return row;
}

function rouletteRow(visual: Extract<FloorRoundVisual, { kind: 'ROULETTE' }>): Container {
  const row = new Container();
  row.position.set(0, 3);
  const color = visual.color === 'RED' ? 0xff2e4d : visual.color === 'BLACK' ? 0x1a1a22 : 0x2fbf71;
  row.addChild(new Graphics().circle(0, 0, 9).fill(color).stroke({ width: 1, color: 0xe8e2d0, alpha: 0.8 }));
  const label = new Text({
    text: visual.pocketLabel,
    style: { fontFamily: 'monospace', fontSize: visual.pocketLabel.length > 2 ? 7 : 9, fontWeight: 'bold', fill: 0xffffff },
  });
  label.anchor.set(0.5);
  row.addChild(label);
  return row;
}

function cardRow(visual: Extract<FloorRoundVisual, { kind: 'CARDS' }>): Container {
  const row = new Container();
  row.position.set(0, 3);
  const text = new Text({
    text: `P ${visual.player.slice(0, 2).join(' ')}  D ${visual.dealer.slice(0, 2).join(' ')}`,
    style: {
      fontFamily: 'monospace',
      fontSize: 7,
      fontWeight: 'bold',
      fill: visual.win ? 0xffd166 : 0x9aa7c7,
    },
  });
  text.anchor.set(0.5);
  row.addChild(text);
  return row;
}

export function buildRoundVisual(visual: FloorRoundVisual): Container {
  if (visual.kind === 'SLOT') return slotRow(visual);
  if (visual.kind === 'SHELL') return shellRow(visual);
  if (visual.kind === 'ROULETTE') return rouletteRow(visual);
  if (visual.kind === 'CARDS') return cardRow(visual);
  const dice = new Text({
    text: `${visual.dice.join(' + ')} = ${visual.sum}`,
    style: { fontFamily: 'monospace', fontSize: 10, fontWeight: 'bold', fill: visual.win ? 0xffd166 : 0x8a97b0 },
  });
  dice.anchor.set(0.5);
  return new Container().addChild(dice);
}
