// A tiny iOS-style app drawn on a canvas: Work / Projects / Skills tabs scoped to one role,
// tappable rows and a project detail page. Each phone owns one instance.
import type { Timeline, TimelineProject, TimelineRole } from '../../lib/timeline';

export const W = 780, H = 1688;
const IOS = { bg: '#000000', cell: '#1c1c1e', pressed: '#3a3a3c', sep: '#38383a', label: '#ffffff', secondary: '#8e8e93', tertiary: '#48484a' };
const SF = '-apple-system, "SF Pro Text", "SF Pro Display", Inter, system-ui, sans-serif';
const TAB_H = 176;

type Ctx = CanvasRenderingContext2D;
type Row = { h: number; draw: (y: number) => void; id?: string; action?: () => void; chevron?: boolean; inset?: number };
type Region = { id: string; x: number; y: number; w: number; h: number; action: () => void };

const initials = (s: string) => s.split(/\s+/).filter((w) => /^[A-Za-z0-9]/.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
const open = (url: string) => window.open(url, '_blank', 'noopener');

// ---- Images are loaded once and shared by every phone ----
const images = new Map<string, HTMLImageElement>();
export async function preload(urls: string[]) {
  await Promise.all([...new Set(urls.filter(Boolean))].map((src) => new Promise<void>((done) => {
    const img = new Image();
    img.onload = () => { images.set(src, img); done(); };
    img.onerror = () => { console.warn(`[phone-stack] could not load ${src}; drawing without it`); done(); };
    img.src = src;
  })));
}

// ---- Drawing helpers ----
const rr = (ctx: Ctx, x: number, y: number, w: number, h: number, r: number) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
function wrap(ctx: Ctx, text: string, x: number, y: number, max: number, lh: number, lines = 99) {
  let line = '', n = 0;
  for (const w of text.split(' ')) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > max && line) {
      if (++n === lines) { ctx.fillText(`${line}…`, x, y); return y + lh; }
      ctx.fillText(line, x, y); y += lh; line = w;
    } else line = test;
  }
  if (line) { ctx.fillText(line, x, y); y += lh; }
  return y;
}
const lineCount = (ctx: Ctx, text: string, max: number) => {
  let line = '', n = 1;
  for (const w of text.split(' ')) { const t = line ? `${line} ${w}` : w; if (ctx.measureText(t).width > max && line) { n++; line = w; } else line = t; }
  return n;
};
/** cover: fill and crop. contain: whole image on dark. photo: whole image over a blurred fill of itself. */
function drawImage(ctx: Ctx, img: HTMLImageElement, x: number, y: number, w: number, h: number, r: number, fit: 'cover' | 'contain' | 'photo' = 'cover') {
  const s = (fit === 'cover' ? Math.max : Math.min)(w / img.width, h / img.height);
  ctx.save(); rr(ctx, x, y, w, h, r); ctx.clip();
  if (fit === 'contain') { ctx.fillStyle = '#111'; ctx.fillRect(x, y, w, h); }
  if (fit === 'photo') {
    const f = Math.max(w / img.width, h / img.height);
    ctx.filter = 'blur(28px) brightness(0.55)';
    ctx.drawImage(img, x + (w - img.width * f) / 2, y + (h - img.height * f) / 2, img.width * f, img.height * f);
    ctx.filter = 'none';
  }
  ctx.drawImage(img, x + (w - img.width * s) / 2, y + (h - img.height * s) / 2, img.width * s, img.height * s);
  ctx.restore();
}
const chevron = (ctx: Ctx, x: number, y: number) => { ctx.strokeStyle = IOS.tertiary; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y - 14); ctx.lineTo(x + 14, y); ctx.lineTo(x, y + 14); ctx.stroke(); };
const arrowOut = (ctx: Ctx, x: number, y: number, c: string) => { ctx.strokeStyle = c; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y + 14); ctx.lineTo(x + 16, y - 2); ctx.moveTo(x + 2, y - 2); ctx.lineTo(x + 16, y - 2); ctx.lineTo(x + 16, y + 12); ctx.stroke(); };

export type PhoneApp = {
  canvas: HTMLCanvasElement;
  render: () => void;
  /** True when (x, y) in canvas pixels is over something tappable. */
  hover: (x: number, y: number) => boolean;
  /** Shows the pressed state, then runs the action. Calls `changed` after each redraw. */
  tap: (x: number, y: number, changed: () => void) => boolean;
};

export function createApp(role: TimelineRole, data: Timeline, tint: string): PhoneApp {
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('2D canvas is not available');
  const ctx = context;
  const own = role.projects.map((id) => data.projects.find((p) => p.id === id)).filter((p): p is TimelineProject => Boolean(p));
  const state: { tab: number; project: TimelineProject | null; pressed: string | null } = { tab: 0, project: null, pressed: null };
  let regions: Region[] = [];
  let y = 0;

  const tabs = [
    { name: 'Work', icon: 0, page: workPage },
    own.length > 0 && { name: 'Projects', icon: 1, page: projectsPage },
    (role.skills.length > 0 || role.courses.length > 0) && { name: 'Skills', icon: 2, page: skillsPage },
  ].filter((t): t is { name: string; icon: number; page: () => void } => Boolean(t)); // only tabs with something to show
  const bottom = () => H - (tabs.length > 1 ? TAB_H : 60) - 40;

  /** Registers a tappable area for the frame being drawn. */
  const hit = (id: string, x: number, yy: number, w: number, h: number, action: () => void) => { regions.push({ id, x, y: yy, w, h, action }); return state.pressed === id; };

  function statusBar() {
    ctx.fillStyle = IOS.label; ctx.font = `600 34px ${SF}`; ctx.fillText('9:41', 92, 70);
    for (let i = 0; i < 4; i++) { rr(ctx, W - 250 + i * 14, 66 - (i + 1) * 7, 10, (i + 1) * 7, 2); ctx.fill(); }
    ctx.lineWidth = 5; ctx.strokeStyle = IOS.label; ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(W - 170, 68, 8 + i * 9, -Math.PI * 0.75, -Math.PI * 0.25); ctx.stroke(); }
    ctx.lineWidth = 3; ctx.strokeStyle = '#ffffff88'; rr(ctx, W - 128, 46, 54, 26, 8); ctx.stroke();
    ctx.fillStyle = IOS.label; rr(ctx, W - 124, 50, 40, 18, 5); ctx.fill(); rr(ctx, W - 71, 54, 4, 10, 2); ctx.fill();
  }

  function backButton(label: string, action: () => void) {
    const down = hit('back', 30, 120, 340, 90, action);
    ctx.globalAlpha = down ? 0.4 : 1;
    ctx.strokeStyle = tint; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(66, 150); ctx.lineTo(50, 166); ctx.lineTo(66, 182); ctx.stroke();
    ctx.fillStyle = tint; ctx.font = `400 34px ${SF}`; ctx.fillText(label, 80, 178);
    ctx.globalAlpha = 1;
  }

  const largeTitle = (text: string) => { ctx.fillStyle = IOS.label; ctx.font = `700 68px ${SF}`; ctx.fillText(text, 56, 220); y = 270; };

  /** Inset grouped list. Rows that don't fit are dropped. */
  function group(title: string, rows: Row[]) {
    const head = title ? 44 : 0;
    const fit: Row[] = [];
    let h = 0;
    for (const r of rows) { if (y + head + h + r.h > bottom()) break; fit.push(r); h += r.h; }
    if (!fit.length) return;
    if (title) { ctx.fillStyle = IOS.secondary; ctx.font = `400 26px ${SF}`; ctx.fillText(title.toUpperCase(), 72, y + 22); y += head; }
    ctx.save(); rr(ctx, 40, y, W - 80, h, 26); ctx.clip();
    ctx.fillStyle = IOS.cell; ctx.fillRect(40, y, W - 80, h);
    fit.forEach((row, i) => {
      if (row.action && row.id && hit(row.id, 40, y, W - 80, row.h, row.action)) { ctx.fillStyle = IOS.pressed; ctx.fillRect(40, y, W - 80, row.h); }
      row.draw(y);
      if (row.action && row.chevron !== false) chevron(ctx, W - 86, y + row.h / 2);
      if (i < fit.length - 1) { ctx.fillStyle = IOS.sep; ctx.fillRect(row.inset ?? 72, y + row.h - 1, W - 40 - (row.inset ?? 72), 2); }
      y += row.h;
    });
    ctx.restore();
    y += 48;
  }

  const textRow = (text: string, lines = 4): Row => {
    ctx.font = `400 31px ${SF}`;
    const n = Math.min(lines, lineCount(ctx, text, W - 144));
    return { h: n * 44 + 46, draw: (ry) => { ctx.font = `400 31px ${SF}`; ctx.fillStyle = IOS.label; wrap(ctx, text, 72, ry + 56, W - 144, 44, lines); } };
  };
  const checkRow = (text: string): Row => {
    ctx.font = `400 31px ${SF}`;
    const n = Math.min(3, lineCount(ctx, text, W - 200));
    return { h: n * 44 + 46, inset: 128, draw: (ry) => {
      ctx.fillStyle = tint; ctx.beginPath(); ctx.arc(92, ry + 46, 18, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(83, ry + 46); ctx.lineTo(90, ry + 53); ctx.lineTo(102, ry + 39); ctx.stroke();
      ctx.font = `400 31px ${SF}`; ctx.fillStyle = IOS.label; wrap(ctx, text, 128, ry + 56, W - 200, 44, 3);
    } };
  };
  const appIcon = (x: number, yy: number, size: number, color: string, text: string, img?: HTMLImageElement) => {
    if (img) return drawImage(ctx, img, x, yy, size, size, size * 0.225);
    const g = ctx.createLinearGradient(x, yy, x + size, yy + size); g.addColorStop(0, color); g.addColorStop(1, `${color}99`);
    ctx.fillStyle = g; rr(ctx, x, yy, size, size, size * 0.225); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `700 ${Math.round(size * 0.4)}px ${SF}`; ctx.textAlign = 'center'; ctx.fillText(text, x + size / 2, yy + size * 0.64); ctx.textAlign = 'left';
  };
  const projectRow = (p: TimelineProject): Row => ({ h: 112, inset: 152, id: `p-${p.id}`, action: () => { state.project = p; }, draw: (ry) => {
    appIcon(64, ry + 20, 72, p.color, p.private ? '' : initials(p.name), images.get(p.image));
    if (p.private) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; rr(ctx, 86, ry + 56, 28, 22, 4); ctx.stroke(); ctx.beginPath(); ctx.arc(100, ry + 56, 9, Math.PI, 0); ctx.stroke(); }
    ctx.fillStyle = IOS.label; ctx.font = `500 32px ${SF}`; wrap(ctx, p.name, 156, ry + 50, W - 280, 40, 1);
    ctx.fillStyle = IOS.secondary; ctx.font = `400 26px ${SF}`; ctx.fillText([p.period, p.private ? 'Client project' : p.tech[0]].filter(Boolean).join(' · '), 156, ry + 88);
  } });

  // ---- Pages ----
  function workPage() {
    y = 150;
    appIcon(56, y, 160, tint, initials(role.org));
    ctx.fillStyle = IOS.label; ctx.font = `700 44px ${SF}`;
    const ny = wrap(ctx, role.org, 244, y + 44, W - 300, 50, 2);
    ctx.fillStyle = IOS.secondary; ctx.font = `400 30px ${SF}`;
    const ty = wrap(ctx, role.title, 244, ny, W - 300, 38, 2);
    // The badge sits under the last title line, so a two-line org or title pushes it down instead of overlapping
    const capY = Math.max(y + 112, ty - 20);
    ctx.font = `700 26px ${SF}`;
    const cap = role.current ? 'CURRENT' : role.kind.toUpperCase(), cw = ctx.measureText(cap).width + 48;
    ctx.fillStyle = role.current ? tint : `${tint}33`; rr(ctx, 244, capY, cw, 50, 25); ctx.fill();
    ctx.fillStyle = role.current ? '#fff' : tint; ctx.fillText(cap, 268, capY + 34);
    y = Math.max(y + 220, capY + 50 + 58);
    // One line of facts leaves the room to the photo; the capsule already names the type unless it says CURRENT
    ctx.fillStyle = IOS.secondary; ctx.font = `400 30px ${SF}`;
    ctx.fillText([role.dates, role.duration, role.current && role.kind].filter(Boolean).join(' · '), 56, y + 30);
    y += 70;
    const photo = images.get(role.image);
    const about = role.summary ? textRow(role.summary, 4) : null, checks = role.highlights.map(checkRow);
    // The photo gives up height first, so About and the highlights stay on screen
    const text = (about ? 44 + about.h + 48 : 0) + (checks.length ? 44 + checks.reduce((s, r) => s + r.h, 0) : 0);
    const ph = photo ? Math.min((W - 80) * photo.height / photo.width, 620, bottom() - y - text - 40) : 0;
    if (photo && ph >= 160) { drawImage(ctx, photo, 40, y, W - 80, ph, 26, 'photo'); y += ph + 40; }
    if (about) group('About', [about]);
    if (checks.length) group('Highlights', checks);
    if (own.length) group('Projects', own.map(projectRow));
  }

  /** Large title plus the role it is scoped to, e.g. "VOIS · Feb 2025 – Present". */
  function scopedTitle(text: string) {
    largeTitle(text);
    ctx.fillStyle = IOS.secondary; ctx.font = `400 28px ${SF}`;
    ctx.fillText(`${role.org} · ${role.dates}`.slice(0, 44), 56, 266);
    y = 310;
  }

  function projectsPage() {
    scopedTitle('Projects');
    group(`At ${role.org}`, own.map(projectRow));
  }

  function projectPage(p: TimelineProject) {
    backButton(tabs[state.tab].name, () => { state.project = null; });
    y = 230;
    appIcon(56, y, 120, p.color, p.private ? '' : initials(p.name));
    ctx.fillStyle = IOS.label; ctx.font = `700 42px ${SF}`;
    const ny = wrap(ctx, p.name, 204, y + 44, W - 260, 48, 2);
    ctx.fillStyle = IOS.secondary; ctx.font = `400 28px ${SF}`; ctx.fillText([p.period, p.private ? 'Private client project' : p.tech.join(', ')].filter(Boolean).join(' · ').slice(0, 40), 204, ny + 4);
    y += 160;
    const shot = images.get(p.image);
    if (shot) { drawImage(ctx, shot, 40, y, W - 80, 340, 26, 'contain'); y += 380; }
    group('About', [textRow(p.description, 4)]);
    const links = [
      p.url && { label: 'View code', value: 'GitHub', url: p.url },
      p.demo && { label: 'Watch demo', value: 'YouTube', url: p.demo },
    ].filter((l): l is { label: string; value: string; url: string } => Boolean(l)).map((l): Row => ({ h: 88, id: `l-${l.label}`, chevron: false, action: () => open(l.url), draw: (ry) => {
      ctx.font = `400 33px ${SF}`; ctx.fillStyle = tint; ctx.fillText(l.label, 72, ry + 56);
      ctx.fillStyle = IOS.secondary; ctx.textAlign = 'right'; ctx.fillText(l.value, W - 110, ry + 56); ctx.textAlign = 'left';
      arrowOut(ctx, W - 92, ry + 44, IOS.tertiary);
    } }));
    if (links.length) group('', links);
    if (p.highlights.length) group('Highlights', p.highlights.map(checkRow));
    if (p.private) group('', [textRow('Details are kept private under the client agreement.', 2)]);
  }

  const chips = (keywords: string[]): Row => {
    ctx.font = `500 28px ${SF}`;
    let x = 72, rows = 1;
    for (const k of keywords) { const w = ctx.measureText(k).width + 44; if (x + w > W - 72) { x = 72; rows++; } x += w + 12; }
    return { h: rows * 66 + 30, draw: (ry) => {
      let cx = 72, cy = ry + 22;
      ctx.font = `500 28px ${SF}`;
      for (const k of keywords) {
        const w = ctx.measureText(k).width + 44;
        if (cx + w > W - 72) { cx = 72; cy += 66; }
        ctx.fillStyle = `${tint}26`; rr(ctx, cx, cy, w, 52, 26); ctx.fill();
        ctx.fillStyle = IOS.label; ctx.fillText(k, cx + 22, cy + 36);
        cx += w + 12;
      }
    } };
  };

  function skillsPage() {
    scopedTitle('Skills');
    if (role.courses.length) group('Coursework', [chips(role.courses)]);
    for (const g of role.skills) group(g.name, [chips(g.keywords)]);
  }

  function tabBar() {
    const n = tabs.length;
    if (n > 1) {
      ctx.fillStyle = '#121214'; ctx.fillRect(0, H - TAB_H, W, TAB_H);
      ctx.fillStyle = IOS.sep; ctx.fillRect(0, H - TAB_H, W, 2);
      tabs.forEach(({ name, icon }, i) => {
        const cx = W / (2 * n) + (i * W) / n, on = i === state.tab && !state.project, col = i === state.tab ? tint : IOS.secondary;
        hit(`tab-${i}`, (i * W) / n, H - TAB_H, W / n, TAB_H - 40, () => { state.tab = i; state.project = null; });
        ctx.globalAlpha = state.pressed === `tab-${i}` ? 0.4 : 1;
        ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.lineJoin = 'round';
        const paint = () => (on ? ctx.fill() : ctx.stroke());
        if (icon === 0) { rr(ctx, cx - 22, H - 146, 44, 34, 6); paint(); rr(ctx, cx - 10, H - 154, 20, 12, 4); ctx.stroke(); }
        if (icon === 1) for (const [dx, dy] of [[-12, -12], [12, -12], [-12, 12], [12, 12]]) { rr(ctx, cx + dx - 9, H - 130 + dy - 9, 18, 18, 4); paint(); }
        if (icon === 2) { ctx.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, rad = k % 2 ? 9 : 22; ctx.lineTo(cx + Math.cos(a) * rad, H - 128 + Math.sin(a) * rad); } ctx.closePath(); paint(); }
        ctx.fillStyle = col; ctx.font = `500 21px ${SF}`; ctx.textAlign = 'center'; ctx.fillText(name, cx, H - 82); ctx.textAlign = 'left';
        ctx.globalAlpha = 1;
      });
    }
    ctx.fillStyle = IOS.label; rr(ctx, W / 2 - 134, H - 30, 268, 10, 5); ctx.fill();
  }

  function render() {
    regions = [];
    ctx.fillStyle = IOS.bg; ctx.fillRect(0, 0, W, H);
    statusBar();
    if (state.project) projectPage(state.project);
    else tabs[state.tab].page();
    tabBar();
  }

  const at = (x: number, yy: number) => regions.find((r) => x >= r.x && x <= r.x + r.w && yy >= r.y && yy <= r.y + r.h);

  return {
    canvas, render,
    hover: (x, yy) => Boolean(at(x, yy)),
    tap(x, yy, changed) {
      const r = at(x, yy);
      if (!r) return false;
      state.pressed = r.id; render(); changed();
      setTimeout(() => { state.pressed = null; r.action(); render(); changed(); }, 110);
      return true;
    },
  };
}
