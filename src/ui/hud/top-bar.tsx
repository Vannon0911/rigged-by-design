import { canAfford, fromVC, toVCString, type VaCoinMicro } from '../../core/economy/vacoin';

const VAULT_STEP = fromVC(1);

export interface TopBarProps {
  readonly cash: VaCoinMicro;
  readonly vault: VaCoinMicro;
  readonly visitors: number;
  readonly avgAddiction: number;
  readonly ledgerOk: boolean;
  readonly notice: string;
  readonly onDeposit: () => void;
  readonly onWithdraw: () => void;
}

export function TopBar({
  cash,
  vault,
  visitors,
  avgAddiction,
  ledgerOk,
  notice,
  onDeposit,
  onWithdraw,
}: TopBarProps) {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark">VC</span>
        <div>
          <h1>Rigged by Design</h1>
          <p>Hinterhof-Parzelle · VaCoin Casino Roguelite</p>
        </div>
      </div>

      <div className="top-stats">
        <div className="stat cash">
          <span>Brieftasche</span>
          <strong>{toVCString(cash)}</strong>
        </div>

        <div className="stat vault">
          <span>Tresor · Deckung</span>
          <strong>{toVCString(vault)}</strong>
          <div className="vault-actions">
            <button type="button" onClick={onDeposit} disabled={!canAfford(cash, VAULT_STEP)}>
              +1 VC
            </button>
            <button type="button" onClick={onWithdraw} disabled={!canAfford(vault, VAULT_STEP)}>
              -1 VC
            </button>
          </div>
        </div>

        <div className="stat guests">
          <span>Aktive Gäste</span>
          <strong>{visitors}</strong>
          <small>Ø Sucht {Math.round(avgAddiction)} %</small>
        </div>

        <div className={ledgerOk ? 'integrity ok' : 'integrity fail'}>
          <span className="integrity-dot" />
          {ledgerOk ? 'Buchhaltung: 100% Gedeckt' : 'Buchhaltung: FEHLER'}
        </div>
      </div>

      <p className="notice" aria-live="polite">{notice}</p>
    </header>
  );
}
