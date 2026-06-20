export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 500,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function notImplemented(feature: string): never {
  throw new AppError('NOT_IMPLEMENTED', `${feature} is not implemented yet`, 501);
}
