import { useState } from 'react';
import type { VaCoinMicro } from '../../core/economy/vacoin';
import { useProgressionStore } from '../../store/progression-store';
import { useWorkshopStore, workshopStore } from '../../store/workshop-store';
import { CPU_LAB_SLOTS } from './lab-model';
import { RngProofPanel } from './rng-proof-panel';
import { SlotBuilderStudio } from './slot-builder-studio';
import { TableGameModder } from './table-game-modder';

export interface WorkshopPageProps {
  readonly cash: VaCoinMicro;
}

export function WorkshopPage({ cash }: WorkshopPageProps) {
  const [target, setTarget] = useState('OWN');
  const workshop = useWorkshopStore();
  const progression = useProgressionStore();
  const cpu = CPU_LAB_SLOTS.find((slot) => slot.id === target);
  const isOwn = target === 'OWN';
  const config = isOwn ? workshop.ownSlot : cpu?.config ?? CPU_LAB_SLOTS[0]!.config;
  const title = isOwn ? 'Eigener Automat' : cpu?.name ?? 'CPU-Slot';
  const note = isOwn
    ? 'Dein umgebauter Slot: Gewichte und Einsatz aendern die echte Mathematik.'
    : cpu?.note ?? '';
  const tabClass = (active: boolean): string => (active ? 'workshop-tab active' : 'workshop-tab');

  return (
    <section className="workshop">
      <header className="panel-head">
        <h2>RNG-Beweis-Labor &amp; Sucht-Werkstatt</h2>
        <span className="hint">Soll vs. Ist auf echten Spins</span>
      </header>

      <div className="workshop-tabs">
        <button type="button" className={tabClass(isOwn)} onClick={() => setTarget('OWN')}>
          Eigener Slot
        </button>
        {CPU_LAB_SLOTS.map((slot) => (
          <button
            type="button"
            key={slot.id}
            className={tabClass(slot.id === target)}
            onClick={() => setTarget(slot.id)}
          >
            {slot.name}
          </button>
        ))}
      </div>

      <RngProofPanel key={config.id} config={config} title={title} note={note} />

      {isOwn && (
        <SlotBuilderStudio
          config={workshop.ownSlot}
          cash={cash}
          ownedMods={workshop.ownedMods}
          onChange={workshopStore.setConfig}
          onBuyMod={workshopStore.buy}
          onToggleMod={workshopStore.toggle}
        />
      )}

      <TableGameModder venueTier={progression.venue.tier} />

      <p className="hint">{workshop.notice}</p>
    </section>
  );
}
