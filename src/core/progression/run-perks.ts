/** Run-Perks und Schwarzmarkt-Blaupausen, die nach einem Tribut waehlbar sind. */
export type RunPerkId =
  | 'PERK_TAX_FREE_CHERRIES'
  | 'PERK_VIP_MAGNET'
  | 'PERK_HUSTLE_MASTER'
  | 'PERK_VAULT_CUSHION'
  | 'PERK_NEAR_MISS_MAESTRO';

export interface RunPerk {
  readonly id: RunPerkId;
  readonly name: string;
  readonly description: string;
  readonly blueprint: boolean;
}

export const RUN_PERKS: readonly RunPerk[] = [
  {
    id: 'PERK_TAX_FREE_CHERRIES',
    name: 'Steuerfreie Kirschen',
    description: 'Blaupause: Kirschen-Auszahlungen bleiben am Syndikat vorbei.',
    blueprint: true,
  },
  {
    id: 'PERK_VIP_MAGNET',
    name: 'VIP-Magnet-Lizenz',
    description: 'Blaupause: High-Roller finden deinen Floor schneller.',
    blueprint: true,
  },
  {
    id: 'PERK_HUSTLE_MASTER',
    name: 'Start-Hütchen-Meister',
    description: 'Blaupause: Der erste Hütchenspiel-Tisch kostet keinen Aufbau.',
    blueprint: true,
  },
  {
    id: 'PERK_VAULT_CUSHION',
    name: 'Tresor-Polster',
    description: 'Sofort +10.0000 VC Deckung fuer den naechsten Tribut.',
    blueprint: false,
  },
  {
    id: 'PERK_NEAR_MISS_MAESTRO',
    name: 'Near-Miss-Maestro',
    description: 'Blaupause: Near-Miss-Suchtaufbau im eigenen Casino steigt.',
    blueprint: true,
  },
];

export function getRunPerk(id: RunPerkId): RunPerk {
  return RUN_PERKS.find((perk) => perk.id === id)!;
}
