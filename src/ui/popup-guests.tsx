/** Gäste: wer spielt, wie geduldig, wie süchtig, wer wartet auf Geld. */
import { ZERO_VC, toVCString, type VaCoinMicro } from '../core/economy/vacoin';
import { getPersona } from '../core/visitors/persona';
import { visitorNetResult, type Visitor } from '../core/visitors/visitor';
import { PopupShell } from './popup-shell';

export interface GuestsPopupProps {
  readonly visitors: readonly Visitor[];
  readonly onPay: (id: number) => void;
  readonly onPayAll: () => void;
  readonly onClose: () => void;
}

function isWaiting(visitor: Visitor): boolean {
  return visitor.pendingPayout > ZERO_VC && visitor.patience <= 0;
}

export function GuestsPopup({ visitors, onPay, onPayAll, onClose }: GuestsPopupProps) {
  const waiting = visitors.filter(isWaiting);
  const pendingTotal = visitors.reduce((sum, visitor) => sum + visitor.pendingPayout, 0) as VaCoinMicro;
  const ordered = [...visitors].sort((left, right) => Number(isWaiting(right)) - Number(isWaiting(left)));

  return (
    <PopupShell eyebrow="LIVE-GÄSTE" title={`${visitors.length} Gäste im Haus`} onClose={onClose}>
      {pendingTotal > 0 && (
        <div className="guest-cashier">
          <div>
            <span className="eyebrow">{waiting.length > 0 ? 'WARTESCHLANGE' : 'GEWINNE GEBUNKERT'}</span>
            <strong>{toVCString(pendingTotal)}</strong>
            <small>{waiting.length > 0 ? 'Sie blockieren ihre Plätze, bis die Kasse zahlt.' : 'Aktive Gäste spielen weiter.'}</small>
          </div>
          <button type="button" className="primary" onClick={onPayAll}>ALLE AUSZAHLEN</button>
        </div>
      )}

      <ul className="guest-list">
        {ordered.map((visitor) => {
          const persona = getPersona(visitor.persona);
          const net = visitorNetResult(visitor);
          return (
            <li key={visitor.id} className={`guest${isWaiting(visitor) ? ' waiting' : ''}`}>
              <div className="guest-head">
                <strong>{visitor.name}</strong>
                <span className="guest-persona" style={{ color: `#${persona.color.toString(16).padStart(6, '0')}` }}>
                  {persona.name}
                </span>
                <span className="guest-wallet">{toVCString(visitor.wallet)}</span>
              </div>
              <div className="bars">
                <div className="bar" title={`Geduld ${Math.round(visitor.patience)}`}>
                  <span className="bar-fill patience" style={{ width: `${Math.max(0, Math.min(100, visitor.patience))}%` }} />
                </div>
                <div className="bar" title={`Sucht ${Math.round(visitor.addiction)}`}>
                  <span className="bar-fill addiction" style={{ width: `${Math.min(100, visitor.addiction)}%` }} />
                </div>
              </div>
              <div className="guest-foot">
                <small>
                  {Math.round(visitor.patience)} Geduld · {Math.round(visitor.addiction)} Sucht · {visitor.spins} Spins
                  <br />
                  Bilanz <b className={net >= 0 ? 'win' : ''}>{net >= 0 ? '+' : ''}{toVCString(net)}</b>
                </small>
                {visitor.pendingPayout > ZERO_VC ? (
                  <button type="button" className="primary" onClick={() => onPay(visitor.id)}>
                    {toVCString(visitor.pendingPayout)} zahlen
                  </button>
                ) : (
                  <small className="muted">{isWaiting(visitor) ? 'wartet' : 'spielt'}</small>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {visitors.length === 0 && <p className="hint">Noch niemand da. Mehr Deko und ein zweiter Automat helfen.</p>}
    </PopupShell>
  );
}
