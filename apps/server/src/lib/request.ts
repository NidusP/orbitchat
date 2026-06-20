import { AppError } from './errors';

export interface JsonBodyRequestLike {
  header(name: string): string | undefined;
  text(): Promise<string>;
}

export async function readOptionalJsonBody<T>(
  request: JsonBodyRequestLike
): Promise<T | undefined> {
  const contentType = request.header('Content-Type');

  if (!contentType?.includes('application/json')) {
    return undefined;
  }

  const rawBody = await request.text();

  if (rawBody.trim() === '') {
    return undefined;
  }

  try {
    return JSON.parse(rawBody) as T;
  } catch {
    throw new AppError('VALIDATION_ERROR', 'Invalid JSON body', 400);
  }
}
