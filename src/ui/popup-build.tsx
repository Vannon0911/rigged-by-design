/** Baumarkt: Objekte kaufen oder zum Platzieren auswählen, Walzen kaufen. */
import type { VaCoinMicro } from '../core/economy/vacoin';
import { itemsForVenue, type ItemId } from '../core/offer/catalog';
import { REELS, type ReelId } from '../core/offer/reels';
import type { VenueTier } from '../core/venues';
import { PopupShell } from './popup-shell';
import { vc } from './format';

export interface BuildPopupProps {
  readonly cash: VaCoinMicro;
  readonly venueTier: VenueTier;
  readonly ownedReels: number;
  readonly onClose: () => void;
  readonly onSelectItem: (id: ItemId) => void;
  readonly onBuyReel: (id: ReelId) => void;
}

export function BuildPopup({ cash, venueTier, ownedReels, onClose, onSelectItem, onBuyReel }: BuildPopupProps) {
  const items = itemsForVenue(venueTier);
  return (
    <PopupShell eyebrow="BAUMARKT" title="Dein Angebot" onClose={onClose} wide>
      <p className="hint">
        Objekt anklicken, dann ein freies Feld auf dem Floor wählen — oder es direkt aus der Leiste ziehen.
        Kasse: {vc(cash)}.
      </p>
      <div className="shop-grid">
        {items.map((item) => {
          const afford = cash >= item.priceVC;
          return (
            <button
              type="button"
              key={item.id}
              className="shop-card"
              disabled={!afford}
              onClick={() => onSelectItem(item.id)}
            >
              <header>
                <strong>{item.name}</strong>
                <span className={afford ? 'price' : 'price bad'}>{vc(item.priceVC)}</span>
              </header>
              <p>{item.description}</p>
              <small>
                {item.kind === 'MACHINE'
                  ? `${item.paylines} Linien · max. ${item.maxMods} Mods · +${(item.attractionBps / 100).toFixed(0)} Anziehung`
                  : `+${(item.spawnBonusBps / 100).toFixed(0)} % Zulauf · ${item.patienceBonus >= 0 ? '+' : ''}${item.patienceBonus} Geduld`}
              </small>
            </button>
          );
        })}
      </div>

      <h3 className="section-title">Walzen ({ownedReels} im Inventar)</h3>
      <div className="reel-shop">
        {REELS.map((reel) => {
          const afford = cash >= reel.priceVC;
          return (
            <button
              type="button"
              key={reel.id}
              className="reel-card"
              disabled={!afford}
              onClick={() => onBuyReel(reel.id)}
            >
              <strong>{reel.name}</strong>
              <span>{reel.symbols.length === 1 ? '1 Symbol' : `${reel.symbols.length} Symbole`}</span>
              <small className={afford ? 'price' : 'price bad'}>{vc(reel.priceVC)}</small>
            </button>
          );
        })}
      </div>
    </PopupShell>
  );
}
