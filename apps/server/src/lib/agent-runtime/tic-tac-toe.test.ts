import { describe, expect, test } from 'bun:test';
import {
  applyTicTacToeMove,
  archiveFinishedGame,
  buildMatchHistorySummary,
  createTicTacToeGame,
  runTicTacToeAction,
  type TicTacToePersistedData,
} from './tic-tac-toe';

describe('tic-tac-toe', () => {
  test('starts with empty board and X to move', () => {
    const game = createTicTacToeGame();
    expect(game.currentPlayer).toBe('X');
    expect(game.phase).toBe('in_progress');
    expect(game.board.every((cell) => cell === null)).toBe(true);
  });

  test('applies alternating moves', () => {
    let state = createTicTacToeGame();
    const first = applyTicTacToeMove(state, 5);
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }
    state = first.state;
    expect(state.board[4]).toBe('X');
    expect(state.currentPlayer).toBe('O');

    const second = applyTicTacToeMove(state, 1);
    expect(second.ok).toBe(true);
    if (!second.ok) {
      return;
    }
    state = second.state;
    expect(state.board[0]).toBe('O');
    expect(state.currentPlayer).toBe('X');
  });

  test('rejects occupied cells', () => {
    let state = createTicTacToeGame();
    const first = applyTicTacToeMove(state, 5);
    if (!first.ok) {
      throw new Error('expected first move to succeed');
    }
    state = first.state;
    const conflict = applyTicTacToeMove(state, 5);
    expect(conflict.ok).toBe(false);
  });

  test('detects X win', () => {
    let state = createTicTacToeGame();
    const moves: number[] = [1, 4, 2, 5, 3];
    for (const position of moves) {
      const result = applyTicTacToeMove(state, position);
      if (!result.ok) {
        throw new Error(`move ${position} failed`);
      }
      state = result.state;
    }
    expect(state.phase).toBe('x_wins');
    expect(state.currentPlayer).toBe(null);
  });

  test('runTicTacToeAction start and status', () => {
    const started = runTicTacToeAction(null, 'start');
    expect(started.result.status).toBe('ok');
    expect(started.nextState?.currentPlayer).toBe('X');

    const status = runTicTacToeAction(started.nextState, 'status');
    expect(status.result.status).toBe('ok');
    expect(status.result.action).toBe('status');
  });

  test('runTicTacToeAction prompts AI after user move', () => {
    const state = createTicTacToeGame();
    const userMove = runTicTacToeAction(state, 'move', 5);
    expect(userMove.result.status).toBe('ok');
    expect(userMove.nextState?.currentPlayer).toBe('O');
    if (userMove.result.status === 'ok') {
      expect(userMove.result.game.currentPlayer).toBe('O');
      expect(userMove.result.message).toContain('your turn');
    }
  });

  test('rejects moves after game is finished', () => {
    let state = createTicTacToeGame();
    for (const position of [1, 4, 2, 5, 3]) {
      const result = applyTicTacToeMove(state, position);
      if (!result.ok) {
        throw new Error(`move ${position} failed`);
      }
      state = result.state;
    }
    const afterFinish = runTicTacToeAction(state, 'move', 9);
    expect(afterFinish.result.status).toBe('error');
    if (afterFinish.result.status === 'error') {
      expect(afterFinish.result.error).toContain('already finished');
    }
  });

  test('archives finished games once and builds match history summary', () => {
    let state = createTicTacToeGame();
    for (const position of [1, 4, 2, 5, 3]) {
      const result = applyTicTacToeMove(state, position);
      if (!result.ok) {
        throw new Error(`move ${position} failed`);
      }
      state = result.state;
    }

    const data: TicTacToePersistedData = { active: state, history: [] };
    archiveFinishedGame(data, state);
    archiveFinishedGame(data, state);

    expect(data.history).toHaveLength(1);
    expect(data.history[0]?.outcome).toBe('x_wins');
    const summary = buildMatchHistorySummary(data.history);
    expect(summary.totalGames).toBe(1);
    expect(summary.userWins).toBe(1);
    expect(summary.aiWins).toBe(0);
  });
});
