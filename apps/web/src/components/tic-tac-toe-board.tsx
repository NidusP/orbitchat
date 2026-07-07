interface TicTacToeBoardProps {
  board: Array<'X' | 'O' | null>;
}

export function TicTacToeBoard({ board }: TicTacToeBoardProps) {
  return (
    <div className="tic-tac-toe-board" aria-label="Tic-tac-toe board">
      {board.map((cell, index) => (
        <div key={index} className={`tic-tac-toe-cell ${cell ? 'tic-tac-toe-cell-marked' : ''}`}>
          {cell ?? index + 1}
        </div>
      ))}
    </div>
  );
}

export function parseTicTacToeToolContent(
  content: string
): { board: Array<'X' | 'O' | null>; boardVisual: string } | null {
  try {
    const parsed = JSON.parse(content) as {
      game?: { board?: Array<'X' | 'O' | null>; boardVisual?: string };
    };
    if (!parsed.game?.board || parsed.game.board.length !== 9) {
      return null;
    }
    return {
      board: parsed.game.board,
      boardVisual: parsed.game.boardVisual ?? '',
    };
  } catch {
    return null;
  }
}
