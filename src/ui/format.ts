/** Kompakte Anzeige: Preise in VC, Quoten in Prozent. */
export function vc(micro: number, digits = 2): string {
  return `${(micro / 10_000).toFixed(digits)} VC`;
}

export function pct(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)} %`;
}
