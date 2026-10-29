/** Prozeduraler Paper-Doll-Renderer (Pixi v8): 5 Layer + Mod-Kosmetik, sofort live. */
import { Container, Graphics } from 'pixi.js';
import type { Appearance, BodyTone, OutfitId } from '../core/character/appearance';
import type { ModCosmetic } from '../core/mods/player-mods';

export interface AvatarViewState {
  readonly appearance: Appearance;
  readonly cosmetics: readonly ModCosmetic[];
  readonly suspicion?: number;
}

const SKIN: Record<BodyTone, number> = { PALE: 0xf2d3b3, TAN: 0xd9a066, OLIVE: 0xb07c52, DEEP: 0x6f4a2f };

const OUTFITS: Record<OutfitId, { coat: number; trim: number; shirt: number }> = {
  RAGS: { coat: 0x5c5145, trim: 0x3b332b, shirt: 0x8a7c69 },
  STREET: { coat: 0x33566b, trim: 0x8fd3ff, shirt: 0xb9c7d6 },
  SUIT: { coat: 0x232a3d, trim: 0x9aa7c7, shirt: 0xe8edf7 },
  MOGUL: { coat: 0x101319, trim: 0xd4af37, shirt: 0xf5efe0 },
};

export class PlayerAvatarView {
  readonly container = new Container();
  readonly #body = new Graphics();
  readonly #outfit = new Graphics();
  readonly #face = new Graphics();
  readonly #head = new Graphics();
  readonly #hand = new Graphics();
  #state: AvatarViewState | null = null;

  constructor(state: AvatarViewState) {
    this.container.addChild(this.#body, this.#outfit, this.#face, this.#head, this.#hand);
    this.update(state);
  }

  /** Mini-Sprite auf dem Floor: einfach herunterskalieren. */
  setScale(scale: number): void {
    this.container.scale.set(scale);
  }

  update(state: AvatarViewState): void {
    this.#state = state;
    this.#drawBody(state);
    this.#drawOutfit(state);
    this.#drawFace(state);
    this.#drawHead(state);
    this.#drawHand(state);
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }

  #has(partId: string): boolean {
    return this.#state?.cosmetics.some((cosmetic) => cosmetic.partId === partId) ?? false;
  }

  #drawBody(state: AvatarViewState): void {
    const g = this.#body;
    const skin = SKIN[state.appearance.bodyTone];
    g.clear();
    if ((state.suspicion ?? 0) >= 60) {
      g.circle(0, -20, 118).stroke({ width: 2, color: 0xff4d4d, alpha: 0.35 });
    }
    g.circle(0, -96, 26).fill(skin);
    g.rect(-8, -74, 16, 16).fill(skin);
    g.roundRect(-28, -60, 56, 82, 12).fill(skin);
    g.roundRect(-44, -56, 16, 66, 8).fill(skin);
    g.roundRect(28, -56, 16, 66, 8).fill(skin);
    g.circle(-36, 14, 9).fill(skin);
    g.circle(36, 14, 9).fill(skin);
    g.roundRect(-20, 20, 17, 74, 6).fill(skin);
    g.roundRect(3, 20, 17, 74, 6).fill(skin);
    g.roundRect(-24, 92, 25, 10, 4).fill(0x1b2333);
    g.roundRect(-1, 92, 25, 10, 4).fill(0x1b2333);
  }

  #drawOutfit(state: AvatarViewState): void {
    const g = this.#outfit;
    const style = OUTFITS[state.appearance.outfitId];
    g.clear();
    g.roundRect(-34, -62, 68, 88, 14).fill(style.coat);
    g.roundRect(-46, -58, 20, 64, 8).fill(style.coat);
    g.roundRect(26, -58, 20, 64, 8).fill(style.coat);
    g.roundRect(-24, 18, 22, 72, 6).fill(style.trim);
    g.roundRect(2, 18, 22, 72, 6).fill(style.trim);
    g.poly([-8, -62, 0, -20, 8, -62]).fill(style.shirt);
    g.rect(-34, -4, 68, 9).fill(style.trim);
    if (state.appearance.outfitId === 'RAGS') {
      g.rect(-27, -42, 12, 12).fill(0x7a6a55);
      g.rect(12, 6, 10, 8).fill(0x7a6a55);
    }
    if (state.appearance.outfitId === 'MOGUL') {
      for (let x = -26; x <= 26; x += 13) g.rect(x, -58, 2, 74).fill({ color: style.trim, alpha: 0.5 });
    }
    if (this.#has('GOLD_CHAIN')) {
      for (let i = 0; i < 5; i += 1) g.circle(-14 + i * 7, -56 + Math.abs(i - 2) * 3, 3).fill(0xffd166);
    }
  }

  #drawFace(state: AvatarViewState): void {
    const g = this.#face;
    g.clear();
    if (this.#has('XRAY_VISOR')) {
      g.roundRect(-27, -110, 54, 13, 4).fill(0x22090c);
      g.rect(-23, -106, 46, 4).fill({ color: 0xff4d4d, alpha: 0.9 });
    } else {
      g.rect(-13, -104, 8, 5).fill(0x1b2333);
      g.rect(5, -104, 8, 5).fill(0x1b2333);
    }
    if (state.appearance.faceId === 'SCAR') g.rect(12, -114, 2, 16).fill(0x8b3a3a);
    if (state.appearance.faceId === 'GRIN') g.roundRect(-8, -92, 16, 4, 2).fill(0x2a1414);
    if (this.#has('TOPHAT_CIGAR')) {
      g.rect(12, -88, 18, 5).fill(0x6b4a2f);
      g.circle(31, -86, 2.5).fill(0xff7a00);
    }
  }

  #drawHead(state: AvatarViewState): void {
    const g = this.#head;
    g.clear();
    if (state.appearance.headgearId === 'CAP') {
      g.roundRect(-30, -120, 60, 7, 3).fill(0x2f3a52);
      g.roundRect(-22, -134, 44, 16, 5).fill(0x2f3a52);
    }
    if (state.appearance.headgearId === 'FEDORA') {
      g.roundRect(-34, -120, 68, 7, 3).fill(0x1f2430);
      g.roundRect(-22, -138, 44, 20, 6).fill(0x1f2430);
      g.rect(-22, -126, 44, 4).fill(0xd4af37);
    }
    if (this.#has('TOPHAT_CIGAR')) {
      g.roundRect(-38, -122, 76, 9, 3).fill(0x0c0e14);
      g.roundRect(-24, -154, 48, 34, 4).fill(0x0c0e14);
      g.rect(-24, -136, 48, 6).fill(0xd4af37);
    }
  }

  #drawHand(state: AvatarViewState): void {
    const g = this.#hand;
    g.clear();
    if (this.#has('SLEEVE_BRACE')) {
      g.roundRect(24, -42, 24, 44, 8).fill(0x77839b);
      g.rect(24, -24, 24, 4).fill(0x3a4357);
      for (const [x, y] of [[32, -34], [42, -34], [32, -8], [42, -8]] as const) {
        g.circle(x, y, 2.2).fill(0xd7dfef);
      }
    }
    if (this.#has('LOADED_DIE')) {
      g.roundRect(28, 0, 24, 24, 5).fill(0x0f2a1e);
      g.roundRect(28, 0, 24, 24, 5).stroke({ width: 2, color: 0x6cf7a8, alpha: 0.9 });
      for (const [x, y] of [[35, 7], [40, 12], [45, 17]] as const) g.circle(x, y, 2.2).fill(0x6cf7a8);
    }
    if (state.appearance.handItemId === 'CHIPS') {
      g.circle(37, 20, 7).fill(0xd4af37);
      g.circle(37, 14, 7).fill(0xb08d2a);
    }
    if (state.appearance.handItemId === 'CIGAR') {
      g.rect(30, 10, 16, 6).fill(0x6b4a2f);
      g.circle(47, 13, 2.5).fill(0xff7a00);
    }
  }
}
