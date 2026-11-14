import { Chess, type Square } from 'chess.js';

/** The shared game lives in the GitHub profile repo; a workflow there applies moves from issues. */
export const PROFILE_REPO = 'usamaeltmsah/usamaeltmsah';
export const STATE_PATH = 'interactive/chess.json';

export interface PlayedMove { uci: string; san: string; user: string }
export interface GameState { game: number; moves: PlayedMove[]; players: Record<string, number> }

const UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

export function parseState(raw: unknown): GameState {
  const s = raw as Partial<GameState> | null;
  if (!s || !Number.isInteger(s.game) || !Array.isArray(s.moves) || typeof s.players !== 'object' || s.players === null) {
    throw new Error('Unexpected chess state shape');
  }
  for (const m of s.moves) {
    if (typeof m?.uci !== 'string' || !UCI.test(m.uci) || typeof m.user !== 'string') throw new Error('Unexpected move in chess state');
  }
  return s as GameState;
}

/** Replays the recorded moves; throws if the history isn't a legal game. */
export function replay(state: GameState): Chess {
  const chess = new Chess();
  for (const { uci } of state.moves) chess.move(fromUci(uci));
  return chess;
}

export function fromUci(uci: string): { from: Square; to: Square; promotion?: string } {
  return { from: uci.slice(0, 2) as Square, to: uci.slice(2, 4) as Square, promotion: uci[4] };
}

export function toUci(from: string, to: string, promotion?: string): string {
  return `${from}${to}${promotion ?? ''}`;
}

/** True when a move from→to is a pawn promotion, so the visitor must pick a piece first. */
export function needsPromotion(chess: Chess, from: Square, to: Square): boolean {
  return chess.moves({ square: from, verbose: true }).some((m) => m.to === to && m.promotion);
}

export function isLegal(chess: Chess, uci: string): boolean {
  const { from, to, promotion } = fromUci(uci);
  return chess.moves({ square: from, verbose: true }).some((m) => m.to === to && (m.promotion ?? undefined) === promotion);
}

/** The pre-filled issue the profile workflow turns into a move; the visitor only presses Create. */
export function moveIssueUrl(uci: string, game: number): string {
  const title = `chess|move|${uci}|${game}`;
  const body = 'Just press **Create** — no need to write anything. Your move is applied within about a minute.';
  return `https://github.com/${PROFILE_REPO}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
}

export function newGameIssueUrl(): string {
  return `https://github.com/${PROFILE_REPO}/issues/new?title=${encodeURIComponent('chess|new')}&body=${encodeURIComponent('Just press **Create** to start a new game.')}`;
}

export function statusText(chess: Chess, game: number): string {
  const side = chess.turn() === 'w' ? 'White' : 'Black';
  if (chess.isCheckmate()) return `Game ${game}: checkmate, ${side === 'White' ? 'Black' : 'White'} wins!`;
  if (chess.isDraw() || chess.isStalemate()) return `Game ${game}: it's a draw.`;
  return `Game ${game} · ${side} to move${chess.inCheck() ? ' · check!' : ''}`;
}

export function topPlayers(state: GameState, limit = 5): [string, number][] {
  return Object.entries(state.players).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit);
}
