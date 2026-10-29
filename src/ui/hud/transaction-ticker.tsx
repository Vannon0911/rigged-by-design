import { toVCString } from '../../core/economy/vacoin';
import type { LedgerEntry } from '../../core/economy/ledger';

export interface TransactionTickerProps {
  readonly entries: readonly LedgerEntry[];
}

export function TransactionTicker({ entries }: TransactionTickerProps) {
  return (
    <section className="ticker">
      <header>
        <h2>Live-Buchungen</h2>
        <span className="hint">Ledger-Log · neueste zuerst</span>
      </header>
      <ul>
        {entries.length === 0 ? (
          <li className="empty">Noch keine Buchung. Arbeite gehen oder einzahlen.</li>
        ) : (
          entries.map((entry) => (
            <li key={entry.seq}>
              <span className="seq">#{entry.seq}</span>
              <span className="flow">{entry.from} → {entry.to}</span>
              <strong>{toVCString(entry.amount)}</strong>
              <span className="reason">{entry.reason}</span>
              <span className="tick">t{entry.tick}</span>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
