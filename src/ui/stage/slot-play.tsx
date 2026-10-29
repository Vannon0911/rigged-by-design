/** Slot-Spielansicht: CPU-Automat oder eigener 3-6-Rollen-Bau. */
import { useEffect, useRef, useState } from 'react';
import { toVCString } from '../../core/economy/vacoin';
import { getCpuCasino } from '../../core/simulation/cpu-casinos';
import type { SlotConfig } from '../../core/slot/slot-types';
import { gameStore, useGameStore } from '../../store/use-game-store';
import { useWorkshopStore } from '../../store/workshop-store';
import { SlotStageView } from '../../stage/slot-stage-view';

export interface SlotPlayProps {
  readonly source: 'CPU' | 'OWN';
  readonly onSource: (source: 'CPU' | 'OWN') => void;
}

export function SlotPlay({ source, onSource }: SlotPlayProps) {
  const game = useGameStore();
  const workshop = useWorkshopStore();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<SlotStageView | null>(null);
  const spinRef = useRef<() => void>(() => undefined);
  const lockRef = useRef(false);
  const [notice, setNotice] = useState('');
  const config: SlotConfig = source === 'CPU' ? getCpuCasino(game.casinoId).slot : workshop.ownSlot;
  const configRef = useRef(config);
  configRef.current = config;

  const spin = async (): Promise<void> => {
    if (lockRef.current) return;
    lockRef.current = true;
    setNotice('...');
    try {
      const result = source === 'CPU'
        ? gameStore.spinCpu()?.spin ?? null
        : gameStore.spinOwnSlot(configRef.current);
      if (!result) { setNotice(gameStore.getSnapshot().notice); return; }
      setNotice(result.totalPayout > 0 ? `+${toVCString(result.totalPayout)}` : result.isNearMiss ? 'Near Miss' : 'Niete');
      await viewRef.current?.spin(result);
    } finally {
      lockRef.current = false;
    }
  };
  spinRef.current = () => void spin();

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let view: SlotStageView | null = null;
    const boot = async (): Promise<void> => {
      const created = await SlotStageView.create(host, () => spinRef.current());
      if (disposed) { created.destroy(); return; }
      view = created;
      viewRef.current = created;
      created.setConfig(configRef.current);
    };
    host.replaceChildren();
    void boot();
    return () => { disposed = true; viewRef.current = null; view?.destroy(); host.replaceChildren(); };
  }, []);

  useEffect(() => { viewRef.current?.setConfig(config); }, [config]);

  return (
    <div className="slot-play">
      <div className="play-subbar">
        <button type="button" className={source === 'CPU' ? 'active' : ''} onClick={() => onSource('CPU')}>CPU-CASINO</button>
        <button type="button" className={source === 'OWN' ? 'active' : ''} onClick={() => onSource('OWN')}>EIGENER SLOT</button>
        <span>{config.reels?.length ?? 3} ROLLEN · {source === 'CPU' ? getCpuCasino(game.casinoId).name : 'DEIN AUTOMAT'}</span>
        <strong>{notice}</strong>
      </div>
      <div className="slot-play-host" ref={hostRef} aria-label="Grosse Slot-Maschine" />
    </div>
  );
}
