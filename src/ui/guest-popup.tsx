/** Gäste-Popup: ein Klick auf einen Gast zeigt Budget, Laune, Geduld und Sucht. */
import type { GameView } from '../store/types';
import { STATE_LABEL, vc } from './format';
import { PopupShell } from './popup-shell';

interface Props {
  readonly view: GameView;
  readonly selectedId: number | null;
  readonly onClose: () => void;
  readonly onPay: (id: number) => void;
  readonly onServe: (id: number) => void;
}

const PERSONA_LABEL: Record<string, string> = {
  LUMPEN: 'Lumpen', STREET: 'Straßentyp', BUSINESS: 'Business', HIGH_ROLLER: 'High Roller', STAMMGAST: 'Stammgast',
};

export function GuestPopup({ view, selectedId, onClose, onPay, onServe }: Props) {
  const guests = [...view.guests].sort((a, b) => {
    const ap = view.guestMoney[a.id]?.pending ?? 0;
    const bp = view.guestMoney[b.id]?.pending ?? 0;
    return bp - ap || a.id - b.id;
  });
  return (
    <PopupShell eyebrow="LIVE AM FLOOR" title="Gäste" onClose={onClose} wide>
      <div className="cashier-strip">
        <div>
          <span>WECHSELKASSE</span>
          <strong>{vc(view.desk, 2)}</strong>
        </div>
        <div>
          <span>OFFENE GEWINNE</span>
          <strong>{vc(view.pending, 2)}</strong>
        </div>
        <p>Gäste wechseln am Eingang. Gewinne bleiben liegen, bis du sie an der Kasse auszahlst.</p>
      </div>
      {guests.length === 0 ? (
        <p className="empty">Noch niemand da. Ordnung und Angebot entscheiden, wie schnell Gäste kommen.</p>
      ) : (
        <ul className="guest-list">
          {guests.map((guest) => {
            const money = view.guestMoney[guest.id] ?? { wallet: 0, pending: 0 };
            const budget = money.wallet + money.pending + guest.fiat;
            return (
              <li key={guest.id} className={`guest-card${selectedId === guest.id ? ' selected' : ''}${money.pending > 0 ? ' owes' : ''}`}>
                <div className="guest-head">
                  <strong>{guest.name}</strong>
                  <span className={`persona persona-${guest.persona}`}>{PERSONA_LABEL[guest.persona] ?? guest.persona}</span>
                  <span className="guest-state">{STATE_LABEL[guest.state] ?? guest.state}</span>
                  <span className="guest-budget">{vc(budget, 2)}</span>
                </div>
                <div className="guest-bars">
                  <Bar label="LAUNE" value={guest.mood} tone="mood" />
                  <Bar label="GEDULD" value={guest.patience} tone="patience" />
                  <Bar label="SUCHT" value={guest.addiction} tone="addiction" />
                </div>
                <div className="guest-foot">
                  <small>
                    {money.wallet > 0 ? `${vc(money.wallet, 2)} in Chips` : guest.fiat > 0 ? `${vc(guest.fiat, 2)} Fiat` : 'kein Geld'}
                    {money.pending > 0 ? ` · ${vc(money.pending, 2)} Gewinn wartet` : ''}
                    {guest.lastResult ? ` · ${guest.lastResult}` : ''}
                  </small>
                  <div className="guest-actions">
                    {view.player.carrying === 'DRINK' && (
                      <button type="button" className="btn small" onClick={() => onServe(guest.id)}>DRINK GEBEN</button>
                    )}
                    {money.pending > 0 ? (
                      <button type="button" className="btn primary small" onClick={() => onPay(guest.id)}>AUSZAHLEN</button>
                    ) : (
                      <small className="muted">{guest.bubble}</small>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </PopupShell>
  );
}

function Bar({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="stat-bar" title={`${label}: ${Math.round(value)}`}>
      <span>{label}</span>
      <div className="track"><i className={`fill ${tone}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>
      <b>{Math.round(value)}</b>
    </div>
  );
}
