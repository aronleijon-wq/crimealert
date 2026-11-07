// Sharing as a picture: an event or a kommun's crime trends drawn as a card in Instagram's
// 4:5 format, with CrimeAlert's logo and the address, for stories, posts and group chats.
// Drawn on the phone; nothing is uploaded.

import { eventUrl, type ShareResult } from '@/lib/share';

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;
const LOGO = '/lovable-uploads/c2e577a8-2adc-46ca-b331-79142ec40f70.png';
const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Display", Inter, system-ui, sans-serif';
const RED = '#ff453a';
const GREEN = '#30d158';

/** "lördag 7 november kl. 12.05" */
export function cardTime(timestamp: number): string {
  const day = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', weekday: 'long', day: 'numeric', month: 'long' }).format(timestamp);
  const time = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', hour: '2-digit', minute: '2-digit' }).format(timestamp).replace(':', '.');
  return `${day} kl. ${time}`;
}

export interface EventCard {
  id: string;
  /** "Inbrott" */
  kind: string;
  area: string;
  /** "lördag 7 november kl. 12.05" */
  when: string;
  active: boolean;
  color: string;
}

export interface TrendCard {
  place: string;
  days: number;
  rows: { label: string; count: number; change: number | null }[];
  url: string;
}

/** Splits text into lines that fit the width, at most `max` lines, the last one shortened */
export function wrapLines(measure: (text: string) => number, text: string, width: number, max: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (measure(next) <= width || !line) line = next;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  if (lines.length <= max) return lines;
  const kept = lines.slice(0, max);
  let last = kept[max - 1];
  while (last.length > 1 && measure(`${last}…`) > width) last = last.slice(0, -1);
  kept[max - 1] = `${last.trimEnd()}…`;
  return kept;
}

const loadImage = (src: string) => new Promise<HTMLImageElement | null>((resolve) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);
  img.src = src;
});

function canvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = CARD_WIDTH;
  c.height = CARD_HEIGHT;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Bilden kunde inte skapas.');
  return [c, ctx];
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** The dark background with a glow in the card's colour, and the logo on top */
async function frame(ctx: CanvasRenderingContext2D, color: string) {
  ctx.fillStyle = '#05080b';
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  // Any CSS colour (hex or hsl), faded by the canvas rather than by its own alpha
  const glow = ctx.createRadialGradient(CARD_WIDTH * 0.8, 260, 40, CARD_WIDTH * 0.8, 260, 900);
  glow.addColorStop(0, color);
  glow.addColorStop(1, 'rgba(5, 8, 11, 0)');
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  ctx.globalAlpha = 1;
  // Faint grid, as on the website
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 2;
  for (let x = 0; x <= CARD_WIDTH; x += 90) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CARD_HEIGHT); ctx.stroke(); }
  for (let y = 0; y <= CARD_HEIGHT; y += 90) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CARD_WIDTH, y); ctx.stroke(); }

  const logo = await loadImage(LOGO);
  if (logo) {
    ctx.save();
    roundRect(ctx, 80, 80, 96, 96, 22);
    ctx.clip();
    ctx.drawImage(logo, 80, 80, 96, 96);
    ctx.restore();
  }
  ctx.textBaseline = 'middle';
  ctx.font = `800 44px ${FONT}`;
  ctx.fillStyle = '#fff';
  ctx.fillText('CRIME', 200, 128);
  ctx.fillStyle = RED;
  ctx.fillText('ALERT', 200 + ctx.measureText('CRIME').width, 128);
}

function footer(ctx: CanvasRenderingContext2D, url: string) {
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(235,235,245,0.6)';
  ctx.font = `500 34px ${FONT}`;
  ctx.fillText('Polisens händelser i hela Sverige', 80, CARD_HEIGHT - 150);
  ctx.fillStyle = '#fff';
  ctx.font = `700 40px ${FONT}`;
  ctx.fillText(url.replace(/^https?:\/\//, ''), 80, CARD_HEIGHT - 92);
}

const toBlob = (c: HTMLCanvasElement) => new Promise<Blob>((resolve, reject) =>
  c.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Bilden kunde inte skapas.'))), 'image/png'));

export async function drawEventCard(event: EventCard): Promise<Blob> {
  const [c, ctx] = canvas();
  await frame(ctx, event.color);
  const measure = (t: string) => ctx.measureText(t).width;

  const lines = (() => { ctx.font = `800 132px ${FONT}`; return wrapLines(measure, event.kind, CARD_WIDTH - 160, 3); })();
  // The block of text sits in the middle of the card, however many lines the kind takes
  const block = (event.active ? 70 : 0) + 150 + lines.length * 140 + 10;
  let y = Math.round(260 + (CARD_HEIGHT - 260 - 260 - block) / 2) + 50;
  if (event.active) {
    ctx.font = `800 34px ${FONT}`;
    const w = measure('PÅGÅR') + 44;
    ctx.fillStyle = RED;
    roundRect(ctx, 80, y - 50, w, 62, 12);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'middle';
    ctx.fillText('PÅGÅR', 102, y - 18);
    y += 70;
  }
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = event.color;
  ctx.beginPath();
  ctx.arc(104, y - 14, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(235,235,245,0.75)';
  ctx.font = `600 44px ${FONT}`;
  ctx.fillText(event.area, 148, y);

  ctx.fillStyle = '#fff';
  ctx.font = `800 132px ${FONT}`;
  y += 150;
  for (const line of lines) { ctx.fillText(line, 76, y); y += 140; }

  ctx.fillStyle = 'rgba(235,235,245,0.75)';
  ctx.font = `500 46px ${FONT}`;
  ctx.fillText(event.when, 80, y + 10);

  footer(ctx, eventUrl(event.id, 'https://crimealert.se'));
  return toBlob(c);
}

export async function drawTrendCard(card: TrendCard): Promise<Blob> {
  const [c, ctx] = canvas();
  await frame(ctx, RED);
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(235,235,245,0.75)';
  ctx.font = `600 44px ${FONT}`;
  ctx.fillText(`Senaste ${card.days} dagarna`, 80, 330);
  ctx.fillStyle = '#fff';
  // A long kommun name takes two lines, in a smaller size, to leave room for the rows
  ctx.font = `800 104px ${FONT}`;
  let title = wrapLines((t) => ctx.measureText(t).width, `Brotten i ${card.place}`, CARD_WIDTH - 160, 2);
  const size = title.length > 1 ? 84 : 104;
  if (title.length > 1) {
    ctx.font = `800 ${size}px ${FONT}`;
    title = wrapLines((t) => ctx.measureText(t).width, `Brotten i ${card.place}`, CARD_WIDTH - 160, 2);
  }
  let y = 440;
  for (const line of title) { ctx.fillText(line, 76, y); y += size + 8; }

  y += 30;
  // As many rows as fit above the note and the address
  const room = Math.max(1, Math.floor((CARD_HEIGHT - 250 - y) / 128));
  for (const row of card.rows.slice(0, Math.min(5, room))) {
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    roundRect(ctx, 80, y, CARD_WIDTH - 160, 108, 24);
    ctx.fill();
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.font = `700 46px ${FONT}`;
    ctx.fillText(row.label, 116, y + 54);
    const change = row.change === null ? '' : `${row.change > 0 ? '↑ +' : row.change < 0 ? '↓ −' : '± '}${Math.abs(row.change)} %`;
    ctx.font = `800 46px ${FONT}`;
    ctx.fillStyle = row.change === null || row.change === 0 ? 'rgba(235,235,245,0.6)' : row.change > 0 ? RED : GREEN;
    const cw = ctx.measureText(change).width;
    ctx.fillText(change, CARD_WIDTH - 116 - cw, y + 54);
    ctx.fillStyle = 'rgba(235,235,245,0.6)';
    ctx.font = `500 40px ${FONT}`;
    const count = `${row.count} st`;
    ctx.fillText(count, CARD_WIDTH - 116 - cw - 40 - ctx.measureText(count).width, y + 54);
    y += 128;
  }
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(235,235,245,0.45)';
  ctx.font = `500 30px ${FONT}`;
  ctx.fillText('Jämfört med perioden före. Källa: Polisens händelser.', 80, y + 30);
  footer(ctx, card.url);
  return toBlob(c);
}

/**
 * Opens the share sheet with the picture, so it can go to Instagram, Messages or a group chat.
 * Where files can't be shared, the picture is saved instead; 'unsupported' if neither works.
 */
export async function shareCard(blob: Blob, { title, text, url, fileName }: { title: string; text: string; url: string; fileName: string }): Promise<ShareResult> {
  const file = new File([blob], fileName, { type: 'image/png' });
  if (typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      // Some apps drop the address when a file comes along, so it is in the text too
      await navigator.share({ files: [file], title, text: `${text} ${url}` });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
    }
  }
  try {
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 10_000);
    return 'shared';
  } catch {
    return 'unsupported';
  }
}
