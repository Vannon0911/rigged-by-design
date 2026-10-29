/** Zentraler Pixi-Floor: gross, responsiv und mit Klick-Hit-Testing fuer Bauen und Geraete. */
import { useEffect, useRef } from 'react';
import { Application } from 'pixi.js';
import type { FloorRoundEvent } from '../core/simulation/floor-events';
import type { FloorView, PlacedItem } from '../core/simulation/floor-types';
import { CasinoFloorView } from './casino-floor-view';
import type { AvatarViewState } from './player-avatar-view';

export interface FloorStageProps {
  readonly floor: FloorView;
  readonly events: readonly FloorRoundEvent[];
  readonly avatar: AvatarViewState;
  readonly revision: unknown;
  readonly onEmptyCell: (x: number, y: number) => void;
  readonly onItem: (item: PlacedItem) => void;
}

export function FloorStage({ floor, events, avatar, revision, onEmptyCell, onItem }: FloorStageProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<CasinoFloorView | null>(null);
  const callbacksRef = useRef({ onEmptyCell, onItem });
  callbacksRef.current = { onEmptyCell, onItem };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let app: Application | null = null;
    let view: CasinoFloorView | null = null;

    const boot = async (): Promise<void> => {
      const created = new Application();
      await created.init({
        background: '#05070d',
        width: 780,
        height: 620,
        antialias: true,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
      });
      if (disposed) { created.destroy(true); return; }
      app = created;
      host.appendChild(created.canvas);
      view = new CasinoFloorView(created, avatar, {
        onEmptyCell: (x, y) => callbacksRef.current.onEmptyCell(x, y),
        onItem: (item) => callbacksRef.current.onItem(item),
      });
      created.stage.addChild(view.container);
      view.update(floor, events, avatar);
      viewRef.current = view;
    };

    host.replaceChildren();
    void boot();
    return () => {
      disposed = true;
      viewRef.current = null;
      view?.destroy();
      if (app) app.destroy(true, { children: true });
      host.replaceChildren();
    };
  }, [floor]);

  useEffect(() => {
    viewRef.current?.update(floor, events, avatar);
  }, [floor, events, avatar, revision]);

  return <div className="casino-canvas-host" ref={hostRef} aria-label="Klickbarer Casino-Floor" />;
}
