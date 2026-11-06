// Miniature d'une ligne : chargee quand la ligne devient visible, icone du format en attendant ou si impossible.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { NativeBridge } from '@forgeoffice/core';
import { thumbKind } from './listing.ts';
import { thumbnail } from './thumbs.ts';
import type { Job } from './queue.ts';

export function Thumb({ job, native, fallback }: { job: Job; native: NativeBridge | null; fallback: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const eligible = thumbKind(job, native !== null) !== null;
  useEffect(() => {
    const el = ref.current;
    if (!eligible || !el) return;
    let alive = true;
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      void thumbnail(job, native).then((u) => alive && setUrl(u));
    });
    io.observe(el);
    return () => {
      alive = false;
      io.disconnect();
    };
  }, [eligible, job, native]);
  return <span ref={ref} className="cv-thumb">{url ? <img src={url} alt="" draggable={false} /> : fallback}</span>;
}
