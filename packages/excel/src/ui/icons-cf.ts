// Icones des jeux d'icones de la mise en forme conditionnelle, dessinees sur canvas (fleches, feux, drapeaux,
// symboles, etoiles, quartiers, barres de notation). Index 0 = plus faible valeur.
import type { IconSetName } from '@forgeoffice/xlsx';

const RED = '#D13438';
const YELLOW = '#F2B700';
const GREEN = '#33A35F';
const GRAY = '#7F7F7F';
const BLACK = '#262626';

function ramp(n: number, i: number, colors: readonly string[]): string {
  return colors[Math.round((i / Math.max(1, n - 1)) * (colors.length - 1))] ?? GRAY;
}

function arrow(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, angle: number, color: string): void {
  ctx.save();
  ctx.translate(x + s / 2, y + s / 2);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.45);
  ctx.lineTo(s * 0.4, 0);
  ctx.lineTo(s * 0.15, 0);
  ctx.lineTo(s * 0.15, s * 0.45);
  ctx.lineTo(-s * 0.15, s * 0.45);
  ctx.lineTo(-s * 0.15, 0);
  ctx.lineTo(-s * 0.4, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawIcon(ctx: CanvasRenderingContext2D, set: IconSetName, index: number, x: number, y: number, s: number): void {
  const n = Number(set.charAt(0)) || 3;
  const cx = x + s / 2;
  const cy = y + s / 2;
  const traffic = [RED, YELLOW, GREEN];
  if (set.includes('Arrows')) {
    const gray = set.includes('Gray');
    const angles = n === 3 ? [Math.PI, Math.PI / 2, 0] : n === 4 ? [Math.PI, (3 * Math.PI) / 4, Math.PI / 4, 0] : [Math.PI, (3 * Math.PI) / 4, Math.PI / 2, Math.PI / 4, 0];
    arrow(ctx, x, y, s, angles[index] ?? 0, gray ? GRAY : ramp(n, index, traffic));
    return;
  }
  if (set.includes('TrafficLights') || set === '3Signs' || set === '4RedToBlack') {
    const colors = set === '4RedToBlack' ? [BLACK, GRAY, '#F4A6B5', RED] : n === 4 ? [BLACK, RED, YELLOW, GREEN] : traffic;
    ctx.fillStyle = colors[index] ?? GRAY;
    ctx.beginPath();
    if (set === '3Signs' && index === 0) ctx.rect(x + s * 0.15, y + s * 0.15, s * 0.7, s * 0.7);
    else if (set === '3Signs' && index === 1) {
      ctx.moveTo(cx, y + s * 0.1);
      ctx.lineTo(x + s * 0.9, y + s * 0.85);
      ctx.lineTo(x + s * 0.1, y + s * 0.85);
    } else ctx.arc(cx, cy, s * 0.42, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (set === '3Flags') {
    ctx.fillStyle = traffic[index] ?? GRAY;
    ctx.fillRect(x + s * 0.25, y + s * 0.1, s * 0.08, s * 0.8);
    ctx.beginPath();
    ctx.moveTo(x + s * 0.33, y + s * 0.12);
    ctx.lineTo(x + s * 0.85, y + s * 0.3);
    ctx.lineTo(x + s * 0.33, y + s * 0.5);
    ctx.fill();
    return;
  }
  if (set.startsWith('3Symbols')) {
    ctx.fillStyle = traffic[index] ?? GRAY;
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = Math.max(1.5, s * 0.12);
    ctx.beginPath();
    if (index === 2) {
      ctx.moveTo(x + s * 0.28, cy);
      ctx.lineTo(x + s * 0.45, y + s * 0.68);
      ctx.lineTo(x + s * 0.72, y + s * 0.32);
    } else if (index === 1) {
      ctx.moveTo(cx, y + s * 0.25);
      ctx.lineTo(cx, y + s * 0.58);
      ctx.moveTo(cx, y + s * 0.7);
      ctx.lineTo(cx, y + s * 0.75);
    } else {
      ctx.moveTo(x + s * 0.32, y + s * 0.32);
      ctx.lineTo(x + s * 0.68, y + s * 0.68);
      ctx.moveTo(x + s * 0.68, y + s * 0.32);
      ctx.lineTo(x + s * 0.32, y + s * 0.68);
    }
    ctx.stroke();
    return;
  }
  if (set === '3Stars') {
    ctx.fillStyle = index === 0 ? '#D9D9D9' : YELLOW;
    ctx.strokeStyle = YELLOW;
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const r = k % 2 === 0 ? s * 0.45 : s * 0.2;
      const a = -Math.PI / 2 + (k * Math.PI) / 5;
      ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
    }
    ctx.closePath();
    if (index === 1) {
      ctx.stroke();
      ctx.save();
      ctx.clip();
      ctx.fillRect(x, y, s / 2, s);
      ctx.restore();
    } else ctx.fill();
    return;
  }
  if (set === '3Triangles') {
    ctx.fillStyle = index === 0 ? RED : index === 1 ? YELLOW : GREEN;
    ctx.beginPath();
    if (index === 1) ctx.rect(x + s * 0.2, cy - s * 0.1, s * 0.6, s * 0.2);
    else if (index === 2) {
      ctx.moveTo(cx, y + s * 0.15);
      ctx.lineTo(x + s * 0.85, y + s * 0.8);
      ctx.lineTo(x + s * 0.15, y + s * 0.8);
    } else {
      ctx.moveTo(cx, y + s * 0.85);
      ctx.lineTo(x + s * 0.85, y + s * 0.2);
      ctx.lineTo(x + s * 0.15, y + s * 0.2);
    }
    ctx.fill();
    return;
  }
  if (set === '5Quarters') {
    ctx.strokeStyle = BLACK;
    ctx.fillStyle = BLACK;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.4, 0, Math.PI * 2);
    ctx.stroke();
    if (index > 0) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, s * 0.4, -Math.PI / 2, -Math.PI / 2 + (index / 4) * Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  // Barres de notation (4Rating, 5Rating, 5Boxes)
  const bars = n === 5 ? 4 : 3;
  for (let k = 0; k < bars; k++) {
    ctx.fillStyle = k < index ? '#2E5BC9' : '#C8C8C8';
    const bh = ((k + 1) / bars) * s * 0.8;
    ctx.fillRect(x + s * 0.1 + k * (s * 0.8 / bars), y + s * 0.9 - bh, s * 0.8 / bars - 1, bh);
  }
}
