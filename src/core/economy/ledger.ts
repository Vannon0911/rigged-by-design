/**
 * Doppelte Buchfuehrung fuer VaCoin. Konten sind dynamisch, damit jeder Gast
 * ein eigenes Wallet und eine eigene Auszahlung besitzt. Kein Geld entsteht
 * ausserhalb einer Buchung gegen EXTERNAL_WORLD.
 */
import { addVC, canAfford, subVC, toVCString, ZERO_VC, type VaCoinMicro } from './vacoin';

const BASE_ACCOUNTS = [
  'EXTERNAL_WORLD',
  'WECHSELKASSE',
  'HAUSKONTO',
  'PORTEMONNAIE',
  'SHOP',
  'STAFF',
  'UTILITIES',
] as const;

export type AccountId = string;

const MINTING_ACCOUNT = 'EXTERNAL_WORLD';

function isMintingAccount(account: AccountId): boolean {
  return account === MINTING_ACCOUNT;
}

class LedgerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LedgerError';
  }
}

export class InsufficientFundsError extends LedgerError {
  constructor(
    readonly account: AccountId,
    readonly requested: VaCoinMicro,
    readonly available: VaCoinMicro,
    readonly reason: string,
  ) {
    super(
      `Unterdeckung auf ${account}: ${toVCString(requested)} angefragt, ` +
        `${toVCString(available)} verfuegbar (Grund: "${reason}")`,
    );
    this.name = 'InsufficientFundsError';
  }
}

interface LedgerEntry {
  readonly seq: number;
  readonly tick: number;
  readonly from: AccountId;
  readonly to: AccountId;
  readonly amount: VaCoinMicro;
  readonly reason: string;
}

export class Ledger {
  readonly #balances = new Map<AccountId, VaCoinMicro>();
  readonly #liabilities = new Set<AccountId>();
  readonly #entries: LedgerEntry[] = [];
  #seq = 0;

  constructor(opening?: Readonly<Record<AccountId, VaCoinMicro>>) {
    for (const account of BASE_ACCOUNTS) this.#balances.set(account, ZERO_VC);
    if (!opening) return;
    for (const [account, amount] of Object.entries(opening)) {
      if (account === MINTING_ACCOUNT || !amount) continue;
      this.transfer(MINTING_ACCOUNT, account, amount, 'opening balance', 0);
    }
  }

  openAccount(account: AccountId): void {
    if (!account.trim()) throw new LedgerError('Konto darf nicht leer sein');
    if (!this.#balances.has(account)) this.#balances.set(account, ZERO_VC);
  }

  /** Verbindlichkeitskonto: darf negativ stehen, damit eine Schuld gebucht statt gekappt wird. */
  openLiability(account: AccountId): void {
    if (!account.trim()) throw new LedgerError('Konto darf nicht leer sein');
    this.#liabilities.add(account);
    this.openAccount(account);
  }

  hasAccount(account: AccountId): boolean {
    return this.#balances.has(account);
  }

  get accounts(): readonly AccountId[] {
    return [...this.#balances.keys()];
  }

  getBalance(account: AccountId): VaCoinMicro {
    return this.#balances.get(account) ?? ZERO_VC;
  }

  snapshot(): Readonly<Record<AccountId, VaCoinMicro>> {
    return Object.freeze(Object.fromEntries(this.#balances));
  }

  get entries(): readonly LedgerEntry[] {
    return Object.freeze([...this.#entries]);
  }

  get circulating(): VaCoinMicro {
    let total = ZERO_VC;
    for (const [account, balance] of this.#balances) {
      if (!isMintingAccount(account)) total = addVC(total, balance);
    }
    return total;
  }

  transfer(from: AccountId, to: AccountId, amount: VaCoinMicro, reason: string, tick: number): LedgerEntry {
    if (!from.trim() || !to.trim()) throw new LedgerError('transfer: Konto fehlt');
    if (from === to) throw new LedgerError('transfer: Quelle und Ziel muessen verschieden sein');
    if (!reason.trim()) throw new LedgerError('transfer: Grund darf nicht leer sein');
    if (!Number.isSafeInteger(tick) || tick < 0) throw new LedgerError('transfer: tick ungueltig');
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new LedgerError('transfer: Betrag muss positiv sein');
    this.openAccount(from);
    this.openAccount(to);

    const available = this.#balances.get(from) ?? ZERO_VC;
    if (!isMintingAccount(from) && !this.#liabilities.has(from) && !canAfford(available, amount)) {
      throw new InsufficientFundsError(from, amount, available, reason);
    }

    this.#balances.set(from, subVC(available, amount));
    this.#balances.set(to, addVC(this.#balances.get(to) ?? ZERO_VC, amount));

    const entry: LedgerEntry = Object.freeze({
      seq: this.#seq,
      tick,
      from,
      to,
      amount,
      reason: reason.trim(),
    });
    this.#seq += 1;
    this.#entries.push(entry);
    return entry;
  }

  verifyLedgerIntegrity(): boolean {
    const replay = new Map<AccountId, VaCoinMicro>();
    for (const account of BASE_ACCOUNTS) replay.set(account, ZERO_VC);
    for (const entry of this.#entries) {
      if (!Number.isSafeInteger(entry.amount) || entry.amount <= 0) return false;
      if (entry.from === entry.to) return false;
      for (const account of [entry.from, entry.to]) {
        if (!replay.has(account)) replay.set(account, ZERO_VC);
      }
      const from = (replay.get(entry.from) ?? 0) - entry.amount;
      const to = (replay.get(entry.to) ?? 0) + entry.amount;
      if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to)) return false;
      if (!isMintingAccount(entry.from) && !this.#liabilities.has(entry.from) && from < 0) return false;
      replay.set(entry.from, from as VaCoinMicro);
      replay.set(entry.to, to as VaCoinMicro);
    }
    let net = 0;
    for (const [account, balance] of this.#balances) {
      if (!isMintingAccount(account) && !this.#liabilities.has(account) && balance < 0) return false;
      if ((replay.get(account) ?? ZERO_VC) !== balance) return false;
      net += balance;
    }
    return net === 0;
  }
}
