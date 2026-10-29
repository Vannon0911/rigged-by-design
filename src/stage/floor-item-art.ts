/** Prozedurale Floor-Objekte: Automaten, Tische und Deko ohne externe Assets. */
import type { Graphics } from 'pixi.js';
import type { BuildableId } from '../core/simulation/catalog';

export function drawFloorItem(g: Graphics, id: BuildableId, px: number, py: number, c: number): void {
  if (id === 'DECO_CARPET') {
    g.roundRect(px + 2, py + 2, c - 4, c - 4, 4).fill(0x3b0e18);
    g.rect(px + 7, py + 7, c - 14, 1).fill({ color: 0x9b2038, alpha: 0.9 });
    g.rect(px + 7, py + c - 8, c - 14, 1).fill({ color: 0x9b2038, alpha: 0.9 });
    return;
  }
  if (id === 'SLOT_RUSTY' || id === 'SLOT_NEON') {
    const neon = id === 'SLOT_NEON' ? 0xff2e88 : 0x00ffcc;
    g.roundRect(px + 5, py + 3, c - 10, c - 7, 5).fill(0x10101b).stroke({ width: 2, color: neon, alpha: 0.85 });
    g.roundRect(px + 10, py + 8, c - 20, c - 24, 3).fill(0x030308);
    for (let row = 0; row < 3; row += 1) {
      g.rect(px + 12, py + 11 + row * 8, c - 24, 1).fill({ color: neon, alpha: 0.25 });
    }
    g.circle(px + c - 11, py + 12, 2.5).fill(0xff4d4d);
    g.rect(px + c * 0.34, py + c - 8, c * 0.32, 3).fill({ color: 0xffd166, alpha: 0.65 });
    return;
  }
  if (id === 'SHELL_CART') {
    g.roundRect(px + 3, py + c - 15, c - 6, 10, 3).fill(0x2b1b10).stroke({ width: 1, color: 0xd4a24a });
    for (let cup = 0; cup < 3; cup += 1) {
      const cx = px + c / 2 + (cup - 1) * 8;
      g.poly([cx - 5, py + c - 15, cx + 5, py + c - 15, cx, py + c - 25]).fill(0xb07a3c)
        .stroke({ width: 1, color: 0xffd166, alpha: 0.4 });
    }
    return;
  }
  if (id === 'DICE_TABLE') {
    g.roundRect(px + 4, py + 9, c - 8, c - 18, 4).fill(0x0d2a1a).stroke({ width: 1, color: 0x00ffcc, alpha: 0.75 });
    g.circle(px + c * 0.38, py + c * 0.48, 5).fill(0xf2ead8).stroke({ width: 1, color: 0xffd166 });
    g.circle(px + c * 0.62, py + c * 0.55, 5).fill(0xf2ead8).stroke({ width: 1, color: 0xffd166 });
    g.circle(px + c * 0.38, py + c * 0.48, 1.4).fill(0x16121c);
    g.circle(px + c * 0.62, py + c * 0.55, 1.4).fill(0x16121c);
    return;
  }
  if (id === 'ROULETTE_TABLE') {
    g.circle(px + c / 2, py + c / 2, c / 2 - 4).fill(0x123322).stroke({ width: 2, color: 0xd4af37, alpha: 0.85 });
    for (let spoke = 0; spoke < 10; spoke += 1) {
      const angle = (Math.PI * 2 * spoke) / 10;
      g.circle(px + c / 2 + Math.cos(angle) * (c / 2 - 9), py + c / 2 + Math.sin(angle) * (c / 2 - 9), 2.2)
        .fill(spoke % 2 === 0 ? 0xff2e4d : 0x111118);
    }
    g.circle(px + c / 2, py + c / 2, 4).fill(0xffd166);
    return;
  }
  if (id === 'BLACKJACK_TABLE' || id === 'POKER_TABLE') {
    const accent = id === 'BLACKJACK_TABLE' ? 0xd4af37 : 0xb06bff;
    g.roundRect(px + 4, py + 7, c - 8, c - 14, 4).fill(0x10301f).stroke({ width: 1, color: accent, alpha: 0.8 });
    g.roundRect(px + c / 2 - 9, py + c / 2 - 9, c - 14, c - 18, 3).fill(0xf3efe3).stroke({ width: 1, color: 0x1a1a22 });
    g.rect(px + c / 2 - 3, py + c / 2 - 4, 3, 9).fill(accent);
    return;
  }
  if (id === 'DECO_NEON_SIGN') {
    g.roundRect(px + 5, py + 7, c - 10, c - 14, 3).fill(0x073b3b).stroke({ width: 1, color: 0x00ffcc, alpha: 0.95 });
    g.rect(px + 9, py + c / 2 - 1, c - 18, 2).fill({ color: 0x00ffcc, alpha: 0.8 });
    g.circle(px + c / 2, py + 13, 2).fill(0xff2e88);
    return;
  }
  if (id === 'DECO_BOOZE') {
    g.roundRect(px + 10, py + 6, c - 20, c - 12, 4).fill(0x3a1d4f).stroke({ width: 1, color: 0xb06bff });
    g.circle(px + c / 2, py + 12, 2.5).fill({ color: 0xe0b3ff, alpha: 0.9 });
  }
}
