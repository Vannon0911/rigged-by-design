/** Hostet die Pixi-Bühne und reicht die Zellposition für Drag and Drop nach außen. */
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Application } from 'pixi.js';
import type { GameSnapshot } from '../store/types';
import { FloorView, type CellPos } from './floor-view';

export interface FloorStageHandle {
  cellAt(clientX: number, clientY: number): CellPos | null;
}

interface FloorStageProps {
  readonly snapshot: GameSnapshot;
  readonly onMachine: (id: number) => void;
  readonly onEmpty: (x: number, y: number) => void;
}

export const FloorStage = forwardRef<FloorStageHandle, FloorStageProps>(function FloorStage(
  { snapshot, onMachine, onEmpty },
  ref,
) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<FloorView | null>(null);
  const callbacks = useRef({ onMachine, onEmpty });
  callbacks.current = { onMachine, onEmpty };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let app: Application | null = null;
    let view: FloorView | null = null;

    void (async () => {
      const created = new Application();
      await created.init({
        background: '#07040f',
        width: 960,
        height: 640,
        antialias: true,
        autoDensity: true,
        resolution: Math.min(2, window.devicePixelRatio || 1),
      });
      if (disposed) {
        created.destroy(true);
        return;
      }
      app = created;
      host.appendChild(created.canvas);
      view = new FloorView(created, {
        onMachine: (id) => callbacks.current.onMachine(id),
        onEmpty: (x, y) => callbacks.current.onEmpty(x, y),
      });
      view.update(snapshot);
      viewRef.current = view;
    })();

    return () => {
      disposed = true;
      viewRef.current = null;
      view?.destroy();
      if (app) app.destroy(true, { children: true });
      host.replaceChildren();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    viewRef.current?.update(snapshot);
  }, [snapshot]);

  useImperativeHandle(ref, () => ({
    cellAt: (clientX, clientY) => viewRef.current?.cellAt(clientX, clientY) ?? null,
  }), []);

  return <div className="floor-stage" ref={hostRef} aria-label="Casino-Floor" />;
});
