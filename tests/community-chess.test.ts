import { describe, expect, it } from 'vitest';
import {
  isLegal, moveIssueUrl, needsPromotion, newGameIssueUrl, parseState, replay, statusText, toUci, topPlayers, type GameState,
} from '../src/lib/community-chess';

const state = (ucis: string[], game = 1): GameState => ({
  game,
  moves: ucis.map((uci, i) => ({ uci, san: '', user: `u${i % 2}` })),
  players: {},
});

describe('parseState', () => {
  it('accepts the profile repo format', () => {
    const s = { game: 1, moves: [{ uci: 'e2e4', san: 'e4', user: 'a' }], players: { a: 1 } };
    expect(parseState(s)).toEqual(s);
  });
  it('rejects a malformed file', () => expect(() => parseState({ game: 'x' })).toThrow());
  it('rejects a bad move string', () => expect(() => parseState({ game: 1, moves: [{ uci: 'e2', user: 'a' }], players: {} })).toThrow());
});

describe('replay', () => {
  it('rebuilds the position and side to move', () => {
    const chess = replay(state(['e2e4', 'e7e5']));
    expect(chess.turn()).toBe('w');
    expect(chess.get('e4')?.type).toBe('p');
  });
  it('throws on an illegal history', () => expect(() => replay(state(['e2e5']))).toThrow());
});

describe('moves', () => {
  it('checks legality from the replayed position', () => {
    const chess = replay(state([]));
    expect(isLegal(chess, 'g1f3')).toBe(true);
    expect(isLegal(chess, 'e2e5')).toBe(false);
  });
  it('detects a promotion and requires its piece', () => {
    const chess = replay(state(['a2a4', 'b7b5', 'a4b5', 'a7a6', 'b5a6', 'c8b7', 'a6a7', 'b7c6']));
    expect(needsPromotion(chess, 'a7', 'b8')).toBe(true);
    expect(needsPromotion(chess, 'g2', 'g3')).toBe(false);
    expect(isLegal(chess, toUci('a7', 'b8', 'q'))).toBe(true);
    expect(isLegal(chess, toUci('a7', 'b8'))).toBe(false);
  });
});

describe('issue links', () => {
  it('match the title format the profile workflow parses', () => {
    const url = new URL(moveIssueUrl('e7e5', 3));
    expect(url.pathname).toBe('/usamaeltmsah/usamaeltmsah/issues/new');
    expect(url.searchParams.get('title')).toBe('chess|move|e7e5|3');
    expect(new URL(newGameIssueUrl()).searchParams.get('title')).toBe('chess|new');
  });
});

describe('statusText', () => {
  it('names the side to move', () => expect(statusText(replay(state(['e2e4'])), 2)).toBe('Game 2 · Black to move'));
  it('reports checkmate', () => expect(statusText(replay(state(['f2f3', 'e7e5', 'g2g4', 'd8h4'])), 1)).toBe('Game 1: checkmate, Black wins!'));
});

describe('topPlayers', () => {
  it('sorts by moves then name', () => {
    expect(topPlayers({ game: 1, moves: [], players: { b: 2, a: 2, c: 5 } })).toEqual([['c', 5], ['a', 2], ['b', 2]]);
  });
});
