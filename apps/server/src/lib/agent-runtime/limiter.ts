import { AppError } from '../errors';

export class AiRunLimiter {
  private activeRuns = 0;

  constructor(private readonly maxRuns: number) {}

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.activeRuns >= this.maxRuns) {
      throw new AppError('AI_BUSY', 'Too many AI requests are running. Please try again soon.', 429);
    }

    this.activeRuns += 1;
    try {
      return await task();
    } finally {
      this.activeRuns -= 1;
    }
  }
}
