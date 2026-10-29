/** Bauleiste: ziehen auf den Floor oder anklicken und ein Feld wählen. */
import { useEffect, useRef, useState } from 'react';
import type { VaCoinMicro } from '../core/economy/vacoin';
import { getItem, itemsForVenue, type ItemId } from '../core/offer/catalog';
import type { VenueTier } from '../core/venues';
import { vc } from './format';

export interface BuildTrayProps {
  readonly venueTier: VenueTier;
  readonly cash: VaCoinMicro;
  readonly selected: ItemId | null;
  readonly onSelect: (id: ItemId | null) => void;
  readonly onDrop: (id: ItemId, clientX: number, clientY: number) => void;
}

interface DragState {
  id: ItemId;
  startX: number;
  startY: number;
  moved: boolean;
}

export function BuildTray({ venueTier, cash, selected, onSelect, onDrop }: BuildTrayProps) {
  const dragRef = useRef<DragState | null>(null);
  const [ghost, setGhost] = useState<{ id: ItemId; x: number; y: number } | null>(null);

  useEffect(() => {
    const move = (event: PointerEvent): void => {
      const drag = dragRef.current;
      if (!drag) return;
      const moved = drag.moved || Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 6;
      dragRef.current = { ...drag, moved };
      setGhost({ id: drag.id, x: event.clientX, y: event.clientY });
    };
    const up = (event: PointerEvent): void => {
      const drag = dragRef.current;
      dragRef.current = null;
      setGhost(null);
      if (!drag) return;
      if (drag.moved) onDrop(drag.id, event.clientX, event.clientY);
      else onSelect(drag.id);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [onDrop, onSelect]);

  const items = itemsForVenue(venueTier);
  return (
    <section className="tray" aria-label="Baumarkt-Leiste">
      <span className="tray-label">ZIEHEN ODER KLICKEN</span>
      <div className="tray-items">
        {items.map((item) => {
          const afford = cash >= item.priceVC;
          return (
            <button
              type="button"
              key={item.id}
              className={`tray-item${selected === item.id ? ' selected' : ''}${afford ? '' : ' poor'}`}
              disabled={!afford}
              onPointerDown={(event) => {
                if (!afford) return;
                event.preventDefault();
                dragRef.current = { id: item.id, startX: event.clientX, startY: event.clientY, moved: false };
                setGhost({ id: item.id, x: event.clientX, y: event.clientY });
              }}
            >
              <strong>{getItem(item.id).name}</strong>
              <small>{vc(item.priceVC)}</small>
            </button>
          );
        })}
      </div>
      {ghost && (
        <div className="drag-ghost" style={{ left: ghost.x, top: ghost.y }}>
          {getItem(ghost.id).name}
        </div>
      )}
    </section>
  );
}
