export type TicTacToeCell = 'X' | 'O' | null;
export type TicTacToePlayer = 'X' | 'O';
export type TicTacToePhase = 'in_progress' | 'x_wins' | 'o_wins' | 'draw';

export interface TicTacToeState {
  board: TicTacToeCell[];
  currentPlayer: TicTacToePlayer | null;
  phase: TicTacToePhase;
  lastMove: { player: TicTacToePlayer; position: number } | null;
  moveCount: number;
}

export type TicTacToeFinishedOutcome = 'x_wins' | 'o_wins' | 'draw';

export interface TicTacToeMatchRecord {
  gameNumber: number;
  finishedAt: string;
  outcome: TicTacToeFinishedOutcome;
  moveCount: number;
  finalBoardVisual: string;
}

export interface TicTacToeMatchHistorySummary {
  totalGames: number;
  userWins: number;
  aiWins: number;
  draws: number;
  recentGames: TicTacToeMatchRecord[];
}

export interface TicTacToePersistedData {
  active: TicTacToeState | null;
  history: TicTacToeMatchRecord[];
}

export interface TicTacToeGameView {
  phase: TicTacToePhase;
  board: TicTacToeCell[];
  boardVisual: string;
  positionMap: string;
  currentPlayer: TicTacToePlayer | null;
  legalMoves: number[];
  userSymbol: TicTacToePlayer;
  aiSymbol: TicTacToePlayer;
  lastMove: { player: TicTacToePlayer; position: number } | null;
}

const WIN_LINES: readonly [number, number, number][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export const TICTACTOE_POSITION_MAP = `
Positions (1-9):
 1 | 2 | 3
---+---+---
 4 | 5 | 6
---+---+---
 7 | 8 | 9
`.trim();

export const TICTACTOE_AGENT_INSTRUCTIONS = `
Tic-tac-toe rules (use play_tictactoe tool):
- User plays X, you play O. X moves first.
- Call play_tictactoe with action "start" when the user wants a new game.
- When the user gives a move (number 1-9), call play_tictactoe with action "move" and position.
- After the user's move, if the game is still in progress and it is your turn (O), you MUST call play_tictactoe again with action "move" and your chosen position in the same reply round.
- When a game ends (win/loss/draw), react naturally to the result and invite a rematch.
- If the user wants another round ("再来一局", "再玩一次", "再来一把", "play again"), call action "start" for a fresh board.
- On action "start", the tool may include matchHistory with prior finished games in this chat. Read those facts and say something original about streaks or the last result — never use canned lines and never ignore the history.
- Use action "status" to read the board without moving.
- Never invent board state; always trust tool results.
- Explain moves briefly and show the boardVisual from the tool in your reply.
`.trim();

export function createTicTacToeGame(): TicTacToeState {
  return {
    board: Array.from({ length: 9 }, () => null),
    currentPlayer: 'X',
    phase: 'in_progress',
    lastMove: null,
    moveCount: 0,
  };
}

export function getLegalMoves(board: TicTacToeCell[]): number[] {
  const moves: number[] = [];
  for (let index = 0; index < board.length; index += 1) {
    if (board[index] === null) {
      moves.push(index + 1);
    }
  }
  return moves;
}

export function formatBoardVisual(board: TicTacToeCell[]): string {
  const render = (index: number): string => board[index] ?? String(index + 1);
  return [
    ` ${render(0)} | ${render(1)} | ${render(2)} `,
    '---+---+---',
    ` ${render(3)} | ${render(4)} | ${render(5)} `,
    '---+---+---',
    ` ${render(6)} | ${render(7)} | ${render(8)} `,
  ].join('\n');
}

function detectPhase(board: TicTacToeCell[]): TicTacToePhase {
  for (const [a, b, c] of WIN_LINES) {
    const cell = board[a];
    if (cell !== null && cell === board[b] && cell === board[c]) {
      return cell === 'X' ? 'x_wins' : 'o_wins';
    }
  }

  if (board.every((cell) => cell !== null)) {
    return 'draw';
  }

  return 'in_progress';
}

function nextPlayer(player: TicTacToePlayer): TicTacToePlayer {
  return player === 'X' ? 'O' : 'X';
}

export function toGameView(state: TicTacToeState): TicTacToeGameView {
  return {
    phase: state.phase,
    board: [...state.board],
    boardVisual: formatBoardVisual(state.board),
    positionMap: TICTACTOE_POSITION_MAP,
    currentPlayer: state.currentPlayer,
    legalMoves: state.phase === 'in_progress' ? getLegalMoves(state.board) : [],
    userSymbol: 'X',
    aiSymbol: 'O',
    lastMove: state.lastMove,
  };
}

export function applyTicTacToeMove(
  state: TicTacToeState,
  position: number,
  expectedPlayer?: TicTacToePlayer
): { ok: true; state: TicTacToeState } | { ok: false; error: string } {
  if (state.phase !== 'in_progress') {
    return { ok: false, error: 'Game is already finished. Call action "start" for a new game.' };
  }

  if (!Number.isInteger(position) || position < 1 || position > 9) {
    return { ok: false, error: 'Position must be an integer from 1 to 9.' };
  }

  const currentPlayer = state.currentPlayer;
  if (!currentPlayer) {
    return { ok: false, error: 'No active player.' };
  }

  if (expectedPlayer && currentPlayer !== expectedPlayer) {
    return {
      ok: false,
      error: `It is ${currentPlayer}'s turn, not ${expectedPlayer}'s.`,
    };
  }

  const index = position - 1;
  if (state.board[index] !== null) {
    return { ok: false, error: `Position ${position} is already occupied.` };
  }

  const board = [...state.board];
  board[index] = currentPlayer;
  const phase = detectPhase(board);
  const next: TicTacToeState = {
    board,
    phase,
    currentPlayer: phase === 'in_progress' ? nextPlayer(currentPlayer) : null,
    lastMove: { player: currentPlayer, position },
    moveCount: state.moveCount + 1,
  };

  return { ok: true, state: next };
}

export type TicTacToeAction = 'start' | 'status' | 'move';

export interface TicTacToeToolSuccess {
  status: 'ok';
  action: TicTacToeAction;
  message: string;
  game: TicTacToeGameView;
  matchHistory?: TicTacToeMatchHistorySummary;
}

export interface TicTacToeToolError {
  status: 'error';
  action: TicTacToeAction;
  error: string;
  game: TicTacToeGameView | null;
}

export type TicTacToeToolResult = TicTacToeToolSuccess | TicTacToeToolError;

function success(
  action: TicTacToeAction,
  message: string,
  state: TicTacToeState
): TicTacToeToolSuccess {
  return {
    status: 'ok',
    action,
    message,
    game: toGameView(state),
  };
}

function failure(
  action: TicTacToeAction,
  error: string,
  state: TicTacToeState | null
): TicTacToeToolError {
  return {
    status: 'error',
    action,
    error,
    game: state ? toGameView(state) : null,
  };
}

function isFinishedOutcome(phase: TicTacToePhase): phase is TicTacToeFinishedOutcome {
  return phase === 'x_wins' || phase === 'o_wins' || phase === 'draw';
}

export function buildMatchHistorySummary(
  history: TicTacToeMatchRecord[]
): TicTacToeMatchHistorySummary {
  const recentGames = history.slice(-5);
  return {
    totalGames: history.length,
    userWins: history.filter((record) => record.outcome === 'x_wins').length,
    aiWins: history.filter((record) => record.outcome === 'o_wins').length,
    draws: history.filter((record) => record.outcome === 'draw').length,
    recentGames,
  };
}

export function archiveFinishedGame(
  data: TicTacToePersistedData,
  state: TicTacToeState
): void {
  if (!isFinishedOutcome(state.phase)) {
    return;
  }

  const lastRecord = data.history[data.history.length - 1];
  if (
    lastRecord &&
    lastRecord.outcome === state.phase &&
    lastRecord.moveCount === state.moveCount
  ) {
    return;
  }

  data.history.push({
    gameNumber: data.history.length + 1,
    finishedAt: new Date().toISOString(),
    outcome: state.phase,
    moveCount: state.moveCount,
    finalBoardVisual: formatBoardVisual(state.board),
  });
}

export function runTicTacToeAction(
  state: TicTacToeState | null,
  action: TicTacToeAction,
  position?: number
): { result: TicTacToeToolResult; nextState: TicTacToeState | null } {
  if (action === 'start') {
    const nextState = createTicTacToeGame();
    return {
      nextState,
      result: success(
        action,
        'New game started. User is X and moves first. Ask the user to pick a position (1-9).',
        nextState
      ),
    };
  }

  if (!state) {
    return {
      nextState: null,
      result: failure(action, 'No active game. Call action "start" first.', null),
    };
  }

  if (action === 'move' && state.phase !== 'in_progress') {
    return {
      nextState: state,
      result: failure(
        action,
        'This game is already finished. Call action "start" if the user wants another round.',
        state
      ),
    };
  }

  if (action === 'status') {
    const message =
      state.phase === 'in_progress'
        ? `Game in progress. Current turn: ${state.currentPlayer}.`
        : `Game finished: ${state.phase}.`;
    return {
      nextState: state,
      result: success(action, message, state),
    };
  }

  if (action === 'move') {
    if (position === undefined) {
      return {
        nextState: state,
        result: failure(action, 'action "move" requires position (1-9).', state),
      };
    }

    const applied = applyTicTacToeMove(state, position);
    if (!applied.ok) {
      return {
        nextState: state,
        result: failure(action, applied.error, state),
      };
    }

    const nextState = applied.state;
    let message: string;
    if (nextState.phase === 'in_progress') {
      if (nextState.currentPlayer === 'O') {
        message = `Move recorded. It is your turn (O). Call play_tictactoe with action "move" and your chosen position. Legal moves: ${getLegalMoves(nextState.board).join(', ')}.`;
      } else {
        message = `Your move (O) is recorded. Ask the user (X) for their next position. Legal moves: ${getLegalMoves(nextState.board).join(', ')}.`;
      }
    } else if (nextState.phase === 'x_wins') {
      message = 'User (X) wins the game.';
    } else if (nextState.phase === 'o_wins') {
      message = 'You (O) win the game.';
    } else {
      message = 'Game ended in a draw.';
    }

    return {
      nextState,
      result: success(action, message, nextState),
    };
  }

  return {
    nextState: state,
    result: failure(action, `Unknown action "${action as string}".`, state),
  };
}
