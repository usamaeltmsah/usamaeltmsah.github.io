import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js';
import {
  PROFILE_REPO, STATE_PATH, isLegal, moveIssueUrl, needsPromotion, newGameIssueUrl, parseState, replay, statusText, toUci, topPlayers,
  type GameState,
} from '../lib/community-chess';

// Filled glyphs for both colours (coloured with CSS); U+FE0E keeps iOS from drawing the pawn as an emoji.
const GLYPH: Record<PieceSymbol, string> = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟︎' };
const NAME: Record<PieceSymbol, string> = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };
const FILES = 'abcdefgh';
const IDLE_POLL_MS = 60_000;
const PENDING_POLL_MS = 10_000;
const PENDING_TIMEOUT_MS = 5 * 60_000;
const DRAG_THRESHOLD_PX = 6;

interface Pending { uci: string; san: string; url: string; since: number; baseLength: number }

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

async function fetchState(): Promise<GameState> {
  // The contents API reflects a push within seconds; raw.githubusercontent is the fallback when its rate limit is hit.
  const api = `https://api.github.com/repos/${PROFILE_REPO}/contents/${STATE_PATH}?ref=master`;
  const raw = `https://raw.githubusercontent.com/${PROFILE_REPO}/master/${STATE_PATH}?t=${Date.now()}`;
  try {
    const res = await fetch(api, { headers: { Accept: 'application/vnd.github.raw+json' }, cache: 'no-store' });
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
    return parseState(await res.json());
  } catch (apiError) {
    console.warn('Falling back to raw file:', apiError);
    const res = await fetch(raw, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Couldn't load the game (${res.status})`);
    return parseState(await res.json());
  }
}

export function mountCommunityChess(): void {
  const board = $<HTMLDivElement>('board');
  const statusEl = $('status');
  const promo = $<HTMLDivElement>('promo');

  let state: GameState | null = null;
  let chess = new Chess();
  let flipped = false;
  let userFlipped = false;
  let selected: Square | null = null;
  let pending: Pending | null = null;
  let pollTimer = 0;

  // ---------- rendering ----------

  function squareOrder(): Square[] {
    const ranks = flipped ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1];
    const files = flipped ? [...FILES].reverse() : [...FILES];
    return ranks.flatMap((r) => files.map((f) => `${f}${r}` as Square));
  }

  function lastMoveSquares(): string[] {
    const last = chess.history({ verbose: true }).at(-1);
    return last ? [last.from, last.to] : [];
  }

  function canPlay(): boolean {
    return state !== null && pending === null && !chess.isGameOver();
  }

  function render(): void {
    const targets = selected ? chess.moves({ square: selected, verbose: true }) : [];
    const last = lastMoveSquares();
    const checkSq = chess.inCheck()
      ? chess.board().flat().find((p) => p?.type === 'k' && p.color === chess.turn())?.square
      : undefined;
    const order = squareOrder();
    board.replaceChildren(...order.map((sq, i) => {
      const piece = chess.get(sq);
      const el = document.createElement('button');
      el.type = 'button';
      el.dataset.sq = sq;
      el.className = 'cc-sq';
      el.tabIndex = sq === (selected ?? order[0]) ? 0 : -1;
      const fileIdx = FILES.indexOf(sq[0]);
      if ((fileIdx + Number(sq[1])) % 2 === 1) el.classList.add('dark'); // a1 is a dark square
      if (last.includes(sq)) el.classList.add('last');
      if (sq === checkSq) el.classList.add('check');
      if (sq === selected) el.classList.add('sel');
      if (canPlay() && piece?.color === chess.turn()) el.classList.add('own');
      const target = targets.find((m) => m.to === sq);
      if (target) el.classList.add('target', ...(target.captured ? ['capture'] : []));
      if (piece) {
        const span = document.createElement('span');
        span.className = `pc ${piece.color}`;
        span.textContent = GLYPH[piece.type];
        el.append(span);
      }
      if (i % 8 === 0) el.append(coord('r', sq[1]));
      if (i >= 56) el.append(coord('f', sq[0]));
      el.setAttribute('aria-label', `${sq}${piece ? `, ${piece.color === 'w' ? 'white' : 'black'} ${NAME[piece.type]}` : ''}${target ? ', legal move' : ''}`);
      return el;
    }));
    board.classList.toggle('waiting', !canPlay());
    board.setAttribute('aria-busy', 'false');
    renderSide();
  }

  function coord(kind: 'f' | 'r', text: string): HTMLElement {
    const s = document.createElement('span');
    s.className = `coord ${kind}`;
    s.textContent = text;
    s.setAttribute('aria-hidden', 'true');
    return s;
  }

  function renderSide(): void {
    if (!state) return;
    statusEl.textContent = statusText(chess, state.game);
    $('pending').hidden = pending === null;
    if (pending) {
      $('pending-san').textContent = pending.san;
      $<HTMLAnchorElement>('pending-link').href = pending.url;
    }
    $('over').hidden = !chess.isGameOver() || pending !== null;
    $<HTMLAnchorElement>('new-game').href = newGameIssueUrl();

    const moves = $('moves');
    const recent = state.moves.slice(-8).reverse();
    moves.replaceChildren(...(recent.length ? recent.map((m) => li(m.san, m.user)) : [muted('No moves yet. Be the first!')]));
    const players = $('players');
    const top = topPlayers(state);
    players.replaceChildren(...(top.length ? top.map(([u, n]) => li('', u, ` · ${n} move${n === 1 ? '' : 's'}`)) : [muted('Nobody yet.')]));
  }

  function li(san: string, user: string, suffix = ''): HTMLLIElement {
    const item = document.createElement('li');
    if (san) {
      const s = document.createElement('span');
      s.className = 'san';
      s.textContent = san;
      item.append(s);
    }
    const a = document.createElement('a');
    a.href = `https://github.com/${encodeURIComponent(user)}`;
    a.textContent = `@${user}`;
    a.target = '_blank';
    a.rel = 'noopener';
    item.append(a, suffix);
    return item;
  }

  function muted(text: string): HTMLLIElement {
    const item = document.createElement('li');
    item.className = 'cc-muted';
    item.textContent = text;
    return item;
  }

  // ---------- loading ----------

  async function load(): Promise<void> {
    try {
      const next = await fetchState();
      const nextChess = replay(next);
      if (pending && next.moves.length > pending.baseLength) pending = null;
      if (pending && Date.now() - pending.since > PENDING_TIMEOUT_MS) pending = null;
      if (pending) return; // keep showing the visitor's previewed move until GitHub applies it
      state = next;
      chess = nextChess;
      if (!userFlipped) flipped = chess.turn() === 'b';
      selected = null;
      render();
    } catch (error) {
      console.error(error);
      if (!state) statusEl.textContent = "Couldn't load the game right now. Try Refresh, or play from my GitHub profile.";
    } finally {
      schedule();
    }
  }

  function schedule(): void {
    window.clearTimeout(pollTimer);
    if (document.hidden) return;
    pollTimer = window.setTimeout(load, pending ? PENDING_POLL_MS : IDLE_POLL_MS);
  }

  // ---------- playing ----------

  function select(sq: Square | null): void {
    selected = sq;
    render();
    if (sq) (board.querySelector(`[data-sq="${sq}"]`) as HTMLElement | null)?.focus({ preventScroll: true });
  }

  function isOwn(sq: Square): boolean {
    return chess.get(sq)?.color === chess.turn();
  }

  function attempt(from: Square, to: Square): void {
    if (!canPlay() || from === to) return;
    if (needsPromotion(chess, from, to)) {
      askPromotion(chess.turn(), (piece) => commit(toUci(from, to, piece)));
      return;
    }
    if (isLegal(chess, toUci(from, to))) commit(toUci(from, to));
    else select(isOwn(to) ? to : null);
  }

  function commit(uci: string): void {
    if (!state || !isLegal(chess, uci)) return;
    const url = moveIssueUrl(uci, state.game);
    const preview = replay(state);
    const san = preview.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san;
    // Opened inside the click/drop handler so pop-up blockers treat it as user-initiated.
    window.open(url, '_blank', 'noopener');
    pending = { uci, san, url, since: Date.now(), baseLength: state.moves.length };
    chess = preview;
    selected = null;
    render();
    schedule();
  }

  function askPromotion(color: Color, done: (piece: PieceSymbol) => void): void {
    const row = document.createElement('div');
    for (const p of ['q', 'r', 'b', 'n'] as PieceSymbol[]) {
      const b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = `<span class="pc ${color}">${GLYPH[p]}</span>`;
      b.setAttribute('aria-label', `Promote to ${NAME[p]}`);
      b.addEventListener('click', () => { promo.hidden = true; done(p); });
      row.append(b);
    }
    promo.replaceChildren(row);
    promo.hidden = false;
    (row.firstElementChild as HTMLElement).focus();
  }

  // ---------- pointer: drag, or tap then tap ----------

  let drag: { from: Square; x: number; y: number; ghost: HTMLElement | null; el: HTMLElement } | null = null;

  board.addEventListener('pointerdown', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('.cc-sq');
    if (!el || !canPlay() || e.button !== 0) return;
    const sq = el.dataset.sq as Square;
    if (selected && sq !== selected && !isOwn(sq)) { attempt(selected, sq); return; }
    if (!isOwn(sq)) { select(null); return; }
    if (selected !== sq) select(sq);
    const fresh = board.querySelector<HTMLElement>(`[data-sq="${sq}"]`)!;
    drag = { from: sq, x: e.clientX, y: e.clientY, ghost: null, el: fresh };
    board.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  board.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (!drag.ghost) {
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < DRAG_THRESHOLD_PX) return;
      const piece = chess.get(drag.from)!;
      drag.ghost = document.createElement('div');
      drag.ghost.className = 'cc-ghost';
      drag.ghost.innerHTML = `<span class="pc ${piece.color}">${GLYPH[piece.type]}</span>`;
      document.body.append(drag.ghost);
      drag.el.classList.add('lifted');
    }
    drag.ghost.style.left = `${e.clientX}px`;
    drag.ghost.style.top = `${e.clientY}px`;
  });

  function endDrag(e: PointerEvent, cancelled: boolean): void {
    if (!drag) return;
    const { from, ghost, el } = drag;
    drag = null;
    ghost?.remove();
    el.classList.remove('lifted');
    if (cancelled || !ghost) return; // a plain tap keeps the piece selected
    const over = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('.cc-sq');
    if (over?.dataset.sq && over.dataset.sq !== from) attempt(from, over.dataset.sq as Square);
  }

  board.addEventListener('pointerup', (e) => endDrag(e, false));
  board.addEventListener('pointercancel', (e) => endDrag(e, true));

  // ---------- keyboard: arrows move focus, Enter/Space selects or plays ----------

  board.addEventListener('keydown', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('.cc-sq');
    if (!el) return;
    const order = squareOrder();
    const i = order.indexOf(el.dataset.sq as Square);
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -8, ArrowDown: 8 };
    if (e.key in step) {
      const next = order[i + step[e.key]];
      if (next) {
        e.preventDefault();
        el.tabIndex = -1;
        const n = board.querySelector<HTMLElement>(`[data-sq="${next}"]`)!;
        n.tabIndex = 0;
        n.focus();
      }
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!canPlay()) return;
      const sq = el.dataset.sq as Square;
      if (selected && !isOwn(sq)) attempt(selected, sq);
      else select(isOwn(sq) && sq !== selected ? sq : null);
    } else if (e.key === 'Escape') {
      select(null);
    }
  });

  // ---------- controls ----------

  $('flip').addEventListener('click', () => { flipped = !flipped; userFlipped = true; render(); });
  $('refresh').addEventListener('click', () => { void load(); });
  $('pending-cancel').addEventListener('click', () => {
    pending = null;
    if (state) chess = replay(state);
    render();
    schedule();
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void load(); });

  render();
  void load();
}
