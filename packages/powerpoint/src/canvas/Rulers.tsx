// Regles horizontale et verticale (centimetres, zero au centre de la page comme PowerPoint).
const CM = 72 / 2.54;

function ticks(length: number, s: number): Array<{ at: number; major: boolean; label?: string }> {
  const out: Array<{ at: number; major: boolean; label?: string }> = [];
  const half = length / 2;
  const step = s < 0.4 ? CM : CM / 4;
  const count = Math.ceil(half / step);
  for (let i = -count; i <= count; i++) {
    const at = half + i * step;
    if (at < 0 || at > length) continue;
    const quarter = Math.round(i * (step / CM) * 4);
    const major = quarter % 4 === 0;
    out.push({ at, major, label: major && (s > 0.5 || quarter % 8 === 0) ? String(Math.abs(quarter / 4)) : undefined });
  }
  return out;
}

export function Ruler({ orientation, length, scale, offset }: { orientation: 'h' | 'v'; length: number; scale: number; offset: number }) {
  const size = length * scale;
  const horizontal = orientation === 'h';
  return (
    <svg className={`fo-ruler is-${orientation}`} width={horizontal ? size : 18} height={horizontal ? 18 : size} style={horizontal ? { left: offset } : { top: offset }} aria-hidden>
      <rect width="100%" height="100%" className="fo-ruler__bg" />
      {ticks(length, scale).map((t, i) => {
        const p = t.at * scale;
        const len = t.major ? 6 : 3;
        return horizontal ? (
          <g key={i}>
            <line x1={p} x2={p} y1={18 - len} y2={18} />
            {t.label && t.label !== '0' && (
              <text x={p} y={10} textAnchor="middle">
                {t.label}
              </text>
            )}
          </g>
        ) : (
          <g key={i}>
            <line y1={p} y2={p} x1={18 - len} x2={18} />
            {t.label && t.label !== '0' && (
              <text y={p + 3} x={8} textAnchor="middle">
                {t.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
