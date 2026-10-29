import { describe, expect, it } from 'vitest';
import { fromVC } from '../../core/economy/vacoin';
import { isSavedTransfer, replayLedger, type SavedTransfer } from '../game-save';

const valid: SavedTransfer = {
  tick: 0,
  from: 'EXTERNAL_WORK',
  to: 'PLAYER_CASH',
  amount: fromVC(5),
  reason: 'opening balance',
};

describe('game-save schema', () => {
  it('akzeptiert nur vollstaendige Transfers mit bekannten Konten', () => {
    expect(isSavedTransfer(valid)).toBe(true);
    expect(isSavedTransfer({ ...valid, from: 'NOT_AN_ACCOUNT' })).toBe(false);
    expect(isSavedTransfer({ ...valid, to: 'NOT_AN_ACCOUNT' })).toBe(false);
    expect(isSavedTransfer({ ...valid, from: 'PLAYER_CASH', to: 'PLAYER_CASH' })).toBe(false);
    expect(isSavedTransfer({ ...valid, amount: 0 })).toBe(false);
    expect(isSavedTransfer({ ...valid, amount: -1 })).toBe(false);
    expect(isSavedTransfer({ ...valid, tick: -1 })).toBe(false);
    expect(isSavedTransfer({ ...valid, reason: '   ' })).toBe(false);
    expect(isSavedTransfer(null)).toBe(false);
    expect(isSavedTransfer('not a transfer')).toBe(false);
  });

  it('verweigert korrupte Ledger-Eintraege vor dem Replay', () => {
    expect(replayLedger([])).not.toBeNull();
    expect(replayLedger([valid])).not.toBeNull();
    expect(replayLedger([{ ...valid, from: 'NOT_AN_ACCOUNT' } as unknown as SavedTransfer])).toBeNull();
    expect(replayLedger([{ ...valid, amount: -1 } as SavedTransfer])).toBeNull();
    expect(replayLedger([{ ...valid, reason: '' } as SavedTransfer])).toBeNull();
  });
});
