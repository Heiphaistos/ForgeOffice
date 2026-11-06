// Barre de repetition du minutage (comme « Chronométrage » de PowerPoint) : temps de la diapositive et total.
import { useEffect, useState } from 'react';
import { Icon } from '@forgeoffice/ui';
import { S2 } from '../strings2.ts';
import type { Rehearsal } from './show-sync.ts';

export const formatClock = (ms: number): string => {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  return `${h ? `${h}:` : ''}${String(m).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

export interface RehearseBarProps {
  rehearsal: Rehearsal;
  onNext: () => void;
  onExit: () => void;
}

export function RehearseBar({ rehearsal, onNext, onExit }: RehearseBarProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div className="pp-rehearse" role="toolbar" aria-label={S2.rehearse.title} onPointerDown={(e) => e.stopPropagation()}>
      <button type="button" title={S2.rehearse.next} onClick={onNext}>
        <Icon name="arrow_right" size={18} />
      </button>
      <span className="pp-rehearse__slide" data-testid="rehearse-slide">{formatClock(rehearsal.currentTime(now))}</span>
      <button type="button" title={S2.rehearse.repeat} onClick={() => rehearsal.restartCurrent(Date.now())}>
        <Icon name="arrow_counterclockwise" size={18} />
      </button>
      <span className="pp-rehearse__total" data-testid="rehearse-total">{formatClock(rehearsal.total() + rehearsal.currentTime(now))}</span>
      <button type="button" title={S2.rehearse.stop} onClick={onExit}>
        <Icon name="dismiss" size={18} />
      </button>
    </div>
  );
}
