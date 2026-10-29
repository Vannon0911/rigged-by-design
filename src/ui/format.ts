/** Kompakte Anzeige: VC ohne Zahlenrauschen. */
export function vc(micro: number, digits = 2): string {
  const value = micro / 10_000;
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}k VC`;
  return `${value.toFixed(digits)} VC`;
}

export function vcShort(micro: number): string {
  return vc(micro, Math.abs(micro) < 100 ? 2 : 0);
}

export function pct(value: number): string {
  return `${Math.round(value)}%`;
}

export const STATE_LABEL: Record<string, string> = {
  ENTER: 'kommt rein',
  EXCHANGE: 'wechselt Geld',
  CHOOSE: 'sucht Platz',
  WAIT: 'wartet',
  PLAY: 'spielt',
  DRINK: 'trinkt',
  TOILET: 'auf dem Klo',
  CASHOUT: 'will auszahlen',
  LEAVE: 'geht',
  ANGRY: 'randaliert',
};
