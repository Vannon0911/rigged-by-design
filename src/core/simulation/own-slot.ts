/** Startkonfiguration des eigenen Automaten und sein Mod-Limit. */
import { fromVC } from '../economy/vacoin';
import type { SlotConfig } from '../slot/slot-types';

export const OWN_SLOT_BASE: SlotConfig = {
  id: 'own-slot',
  baseBet: fromVC(0.5),
  paylines: ['MIDDLE'],
  mods: [],
};

export const OWN_SLOT_MAX_MODS = 3;
