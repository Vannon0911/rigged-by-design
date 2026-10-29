import { describe, expect, it } from 'vitest';
import { synergiesOf } from '../synergy';

describe('Mod-Kombis', () => {
  it('zwei NEON-Mods ergeben Neon-Overkill', () => {
    const list = synergiesOf(['MOD_NEON_FRAME', 'MOD_NEAR_MISS']);
    expect(list.map((synergy) => synergy.id)).toContain('SYN_NEON_OVERKILL');
  });

  it('gemischte Tags ergeben die passende Paar-Kombi', () => {
    expect(synergiesOf(['MOD_CHERRY_FLOOD', 'MOD_FREE_DRINK']).map((synergy) => synergy.id)).toContain('SYN_STAMMTISCH');
    expect(synergiesOf(['MOD_EXTRA_LINE', 'MOD_EXTRA_REEL']).map((synergy) => synergy.id)).toContain('SYN_VABANQUE');
  });

  it('ein einzelner Mod ergibt keine Kombi', () => {
    expect(synergiesOf(['MOD_NEON_FRAME'])).toHaveLength(0);
    expect(synergiesOf([])).toHaveLength(0);
  });
});
