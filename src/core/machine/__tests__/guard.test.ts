import { describe, expect, it } from 'vitest';
import { fromVC } from '../../economy/vacoin';
import { getItem, ITEMS } from '../../offer/catalog';
import { assertRtp, estimateRtp, guardMachine } from '../guard';
import type { MachineState } from '../machine';
import type { ReelId } from '../../offer/reels';

function machine(reels: readonly ReelId[], catalogId: MachineState['catalogId'] = 'SLOT_RUSTY'): MachineState {
  return { id: 1, catalogId, x: 0, y: 0, reels, mods: [], baseBet: fromVC(0.05) };
}

describe('EV-Guard', () => {
  it('laesst den Startautomaten durch', () => {
    const starter = machine(getItem('SLOT_RUSTY').starterReels);
    const guard = guardMachine(starter, 1);
    expect(guard.ok).toBe(true);
    expect(guard.rtp).toBeGreaterThan(0.7);
    expect(guard.rtp).toBeLessThan(0.95);
  });

  it('blockt drei Ein-Symbol-Siebenen als Gelddrucker', () => {
    const exploit = machine(['REEL_SINGLE_SEVEN', 'REEL_SINGLE_SEVEN', 'REEL_SINGLE_SEVEN']);
    const guard = guardMachine(exploit, 1);
    expect(guard.ok).toBe(false);
    expect(guard.rtp).toBeGreaterThan(1);
    expect(() => assertRtp(exploit, 1)).toThrow(/Gelddrucker/);
  });

  it('erlaubt eine gierige, aber nicht exploitbare Maschine', () => {
    const greedy = machine(['REEL_STREET', 'REEL_STREET', 'REEL_STREET']);
    const guard = guardMachine(greedy, 1);
    expect(guard.ok).toBe(true);
    expect(guard.greedy).toBe(true);
  });

  it('rechnet deterministisch: gleicher Seed, gleicher RTP', () => {
    const starter = machine(getItem('SLOT_RUSTY').starterReels);
    expect(estimateRtp(starter, 4000).rtp).toBe(estimateRtp(starter, 4000).rtp);
  });

  it('haelt jedes Katalog-Angebot im Deckel seiner Stufe', () => {
    for (const item of ITEMS.filter((entry) => entry.kind === 'MACHINE')) {
      const starter = machine(item.starterReels, item.id as MachineState['catalogId']);
      const guard = guardMachine(starter, item.minVenueTier);
      expect(guard.ok, `${item.id}: ${guard.reason}`).toBe(true);
    }
  });
});
