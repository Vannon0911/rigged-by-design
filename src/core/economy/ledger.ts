/**
 * Doppelte Buchfuehrung fuer VaCoin. Headless: kein DOM, kein React, kein Pixi.
 *
 * Konten (jede Bewegung ist ein Transfer zwischen zwei Konten):
 *  PLAYER_CASH      - Guthaben des Spielers
 *  CASINO_VAULT     - eigenes Deckungskapital des Casinos
 *  VISITOR_WALLET   - gepooltes Bargeld der Besucher auf dem Floor
 *  PENDING_PAYOUT   - reservierte Gewinne, die der Spieler noch auszahlen muss
 *  EXTERNAL_WORK    - Aussenwelt: einzige Quelle/Senke fuer neues Geld (darf negativ sein)
 *  SHOP_VENDOR      - Shop-/Vendor-Konto
 *
 * Geldschoepfung ist damit keine Buchung "aus dem Nichts", sondern eine Buchung
 * gegen EXTERNAL_WORK. Alle anderen Konten duerfen niemals negativ werden.
 */
import { addVC, canAfford, subVC, toVCString, ZERO_VC, type VaCoinMicro } from './vacoin';

export const ACCOUNTS = [
  'PLAYER_CASH',
  'CASINO_VAULT',
  'VISITOR_WALLET',
  'PENDING_PAYOUT',
  'EXTERNAL_WORK',
  'SHOP_VENDOR',
] as const;

export type AccountId = (typeof ACCOUNTS)[number];
export type Balances = Readonly<Record<AccountId, VaCoinMicro>>;

/** Nur diese Konten sind Gegenpartei der Aussenwelt und duerfen negativ werden. */
export const MINTING_ACCOUNTS: readonly AccountId[] = ['EXTERNAL_WORK'];

export class LedgerError extends Error {
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

export interface LedgerEntry {
  readonly seq: number;
  readonly tick: number;
  readonly from: AccountId;
  readonly to: AccountId;
  readonly amount: VaCoinMicro;
  readonly reason: string;
  /** Unveraenderlicher Schnappschuss aller Salden nach der Buchung. */
  readonly balancesAfter: Balances;
}

export function isMintingAccount(account: AccountId): boolean {
  return MINTING_ACCOUNTS.includes(account);
}

function emptyBalances(): Record<AccountId, VaCoinMicro> {
  const balances = {} as Record<AccountId, VaCoinMicro>;
  for (const account of ACCOUNTS) balances[account] = ZERO_VC;
  return balances;
}

export class Ledger {
  readonly #balances: Record<AccountId, VaCoinMicro> = emptyBalances();
  readonly #entries: LedgerEntry[] = [];
  #seq = 0;

  /** Startkapital wird als Buchung gegen EXTERNAL_WORK gebucht, nicht still gesetzt. */
  constructor(opening?: Partial<Record<AccountId, VaCoinMicro>>) {
    if (!opening) return;
    for (const account of ACCOUNTS) {
      if (account === 'EXTERNAL_WORK') continue;
      const amount = opening[account];
      if (amount === undefined || amount === ZERO_VC) continue;
      this.transfer('EXTERNAL_WORK', account, amount, 'opening balance', 0);
    }
  }

  getBalance(account: AccountId): VaCoinMicro {
    return this.#balances[account];
  }

  snapshot(): Balances {
    return Object.freeze({ ...this.#balances });
  }

  get entries(): readonly LedgerEntry[] {
    return Object.freeze([...this.#entries]);
  }

  /** Umlaufendes Geld = Summe aller Nicht-Minting-Konten. */
  get circulating(): VaCoinMicro {
    let total = ZERO_VC;
    for (const account of ACCOUNTS) {
      if (isMintingAccount(account)) continue;
      total = addVC(total, this.#balances[account]);
    }
    return total;
  }

  transfer(
    from: AccountId,
    to: AccountId,
    amount: VaCoinMicro,
    reason: string,
    tick: number,
  ): LedgerEntry {
    if (!ACCOUNTS.includes(from)) throw new LedgerError(`transfer: unbekanntes Konto "${from}"`);
    if (!ACCOUNTS.includes(to)) throw new LedgerError(`transfer: unbekanntes Konto "${to}"`);
    if (from === to) throw new LedgerError('transfer: Quelle und Ziel muessen verschieden sein');
    if (typeof reason !== 'string' || reason.trim() === '') {
      throw new LedgerError('transfer: Grund darf nicht leer sein');
    }
    if (!Number.isSafeInteger(tick) || tick < 0) {
      throw new LedgerError(`transfer: tick muss eine nicht-negative Ganzzahl sein, erhalten ${String(tick)}`);
    }
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new LedgerError(`transfer: Betrag muss eine positive Ganzzahl sein, erhalten ${String(amount)}`);
    }

    const available = this.#balances[from];
    if (!isMintingAccount(from) && !canAfford(available, amount)) {
      throw new InsufficientFundsError(from, amount, available, reason);
    }

    this.#balances[from] = subVC(available, amount);
    this.#balances[to] = addVC(this.#balances[to], amount);

    const entry: LedgerEntry = Object.freeze({
      seq: this.#seq,
      tick,
      from,
      to,
      amount,
      reason: reason.trim(),
      balancesAfter: this.snapshot(),
    });
    this.#seq += 1;
    this.#entries.push(entry);
    return entry;
  }

  /**
   * Prueft die Buchhaltung komplett neu aus dem Log:
   * 1. jede Buchung ist gueltig (positiv, zwei verschiedene Konten),
   * 2. kein gedecktes Konto war je negativ,
   * 3. nachgespielte Salden == aktuelle Salden,
   * 4. Summe aller Kontenbewegungen ist exakt 0 (nichts gedruckt, nichts vernichtet).
   */
  verifyLedgerIntegrity(): boolean {
    const replay = emptyBalances();
    for (const entry of this.#entries) {
      if (!Number.isSafeInteger(entry.amount) || entry.amount <= 0) return false;
      if (entry.from === entry.to) return false;
      replay[entry.from] = (replay[entry.from] - entry.amount) as VaCoinMicro;
      replay[entry.to] = (replay[entry.to] + entry.amount) as VaCoinMicro;
      if (!isMintingAccount(entry.from) && replay[entry.from] < 0) return false;
      if (!Number.isSafeInteger(replay[entry.from]) || !Number.isSafeInteger(replay[entry.to])) {
        return false;
      }
    }

    let net = 0;
    for (const account of ACCOUNTS) {
      if (replay[account] !== this.#balances[account]) return false;
      if (!isMintingAccount(account) && this.#balances[account] < 0) return false;
      net += this.#balances[account];
    }
    return net === 0;
  }
}
