import { AppError } from '../errors';

export class AiRunLimiter {
  private activeRuns = 0;

  constructor(private readonly maxRuns: number) {}

  tryAcquire(): boolean {
    if (this.activeRuns >= this.maxRuns) {
      return false;
    }

    this.activeRuns += 1;
    return true;
  }

  release(): void {
    if (this.activeRuns > 0) {
      this.activeRuns -= 1;
    }
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (!this.tryAcquire()) {
      throw new AppError('AI_BUSY', 'Too many AI requests are running. Please try again soon.', 429);
    }

    try {
      return await task();
    } finally {
      this.release();
    }
  }
}
