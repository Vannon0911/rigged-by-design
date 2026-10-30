/** Was die UI sieht: Welt plus abgeleitete Ledger-Werte. */
import type { VaCoinMicro } from '../core/economy/vacoin';
import type { Guest, Player, PriceBook, StaffState, TemplateId, Zone, Furniture, CarpetId } from '../core/sim/types';

export interface GameView {
  readonly template: TemplateId;
  readonly size: number;
  readonly zones: readonly Zone[];
  readonly furniture: readonly Furniture[];
  readonly guests: readonly Guest[];
  readonly capacity: number;
  readonly player: Player;
  readonly dirtyTiles: readonly number[];
  readonly tick: number;
  readonly day: number;
  readonly staff: StaffState;
  readonly prices: PriceBook;
  readonly carpet: CarpetId;
  readonly lastEvent: string;
  readonly house: VaCoinMicro;
  readonly wallet: VaCoinMicro;
  readonly desk: VaCoinMicro;
  readonly pending: VaCoinMicro;
  readonly guestMoney: Readonly<Record<number, { readonly wallet: VaCoinMicro; readonly pending: VaCoinMicro; readonly fiat: VaCoinMicro }>>;
  readonly mood: number;
  readonly reputation: number;
  readonly ledgerOk: boolean;
  readonly notice: string;
}
