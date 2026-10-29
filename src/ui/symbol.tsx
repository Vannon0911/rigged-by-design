/** Slot-Symbole als SVG: gleiche Sprache wie die Pixi-Symbole auf dem Floor. */
import type { SlotSymbol } from '../core/slot/slot-types';

export function Symbol({ symbol, size = 40 }: { readonly symbol: SlotSymbol; readonly size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="slot-symbol">
      {symbol === 'BLANK' && (
        <polygon
          points="26,10 38,10 38,26 54,26 54,38 38,38 38,54 26,54 26,38 10,38 10,26 26,26"
          fill="#3a3545"
          stroke="#6f687f"
          strokeWidth="2"
        />
      )}
      {symbol === 'CHERRY' && (
        <>
          <path d="M26 42 Q28 20 44 16" stroke="#35e08a" strokeWidth="3" fill="none" />
          <path d="M40 40 Q40 22 44 16" stroke="#35e08a" strokeWidth="3" fill="none" />
          <ellipse cx="49" cy="14" rx="7" ry="4" fill="#35e08a" />
          <circle cx="22" cy="44" r="11" fill="#ff0055" />
          <circle cx="42" cy="42" r="11" fill="#ff0055" />
          <circle cx="18" cy="40" r="3" fill="#fff" opacity="0.8" />
        </>
      )}
      {symbol === 'BELL' && (
        <>
          <polygon points="16,40 22,22 32,12 42,22 48,40" fill="#ffcc00" stroke="#fff2a8" strokeWidth="2" />
          <rect x="14" y="40" width="36" height="6" rx="3" fill="#ffcc00" />
          <circle cx="32" cy="50" r="4.5" fill="#fff2a8" />
        </>
      )}
      {symbol === 'SEVEN' && (
        <>
          <polygon points="23,17 55,17 55,29 39,59 27,59 43,29 23,29" fill="#ff7a00" />
          <polygon points="18,12 50,12 50,24 34,54 22,54 38,24 18,24" fill="#ff2e88" stroke="#ffb3d9" strokeWidth="2" />
        </>
      )}
      {symbol === 'VACOIN_DIAMOND' && (
        <>
          <polygon points="32,8 54,32 32,56 10,32" fill="#00ffcc" />
          <polygon points="32,16 46,32 32,48 18,32" fill="#0a5f55" stroke="#bafff2" strokeWidth="1.5" />
          <circle cx="32" cy="32" r="5" fill="#fff" opacity="0.85" />
        </>
      )}
      {symbol === 'WILD' && (
        <>
          <polygon
            points="32,8 38,25 56,25 42,36 47,54 32,43 17,54 22,36 8,25 26,25"
            fill="#a855f7"
            stroke="#f0abfc"
            strokeWidth="2"
          />
          <path d="M24 23 L28 41 M32 22 L32 42 M40 23 L36 41" stroke="#fff" strokeWidth="3" />
        </>
      )}
    </svg>
  );
}

export function SymbolRow({ symbols, size = 32 }: { readonly symbols: readonly SlotSymbol[]; readonly size?: number }) {
  return (
    <span className="symbol-row">
      {symbols.map((symbol, index) => (
        <Symbol key={`${symbol}-${index}`} symbol={symbol} size={size} />
      ))}
    </span>
  );
}
