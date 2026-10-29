/** Tresor-Bewegungen zwischen Spielerbargeld und Casino-Deckung. */
import type { Ledger } from '../core/economy/ledger';
import { canAfford, toVCString, type VaCoinMicro } from '../core/economy/vacoin';

export function moveVault(
  ledger: Ledger,
  direction: 'IN' | 'OUT',
  amount: VaCoinMicro,
  tick: number,
): string {
  if (direction === 'IN') {
    if (!canAfford(ledger.getBalance('PLAYER_CASH'), amount)) {
      throw new Error('Nicht genug Bargeld fuer die Einzahlung.');
    }
    ledger.transfer('PLAYER_CASH', 'CASINO_VAULT', amount, 'vault deposit', tick);
    return `${toVCString(amount)} in den Tresor gelegt.`;
  }
  if (!canAfford(ledger.getBalance('CASINO_VAULT'), amount)) throw new Error('Der Tresor ist leer.');
  ledger.transfer('CASINO_VAULT', 'PLAYER_CASH', amount, 'vault withdraw', tick);
  return `${toVCString(amount)} aus dem Tresor geholt.`;
}
