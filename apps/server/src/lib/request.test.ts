import { describe, expect, test } from 'bun:test';
import { AppError } from './errors';
import { readOptionalJsonBody, type JsonBodyRequestLike } from './request';

function createRequest(body: string, contentType?: string): JsonBodyRequestLike {
  return {
    header(name: string): string | undefined {
      return name === 'Content-Type' ? contentType : undefined;
    },
    async text(): Promise<string> {
      return body;
    },
  };
}

describe('readOptionalJsonBody', () => {
  test('returns undefined when JSON content type is absent', async () => {
    const result = await readOptionalJsonBody(createRequest('{"refreshToken":"token"}'));
    expect(result).toBeUndefined();
  });

  test('returns undefined for an empty JSON body', async () => {
    const result = await readOptionalJsonBody(createRequest('', 'application/json'));
    expect(result).toBeUndefined();
  });

  test('parses a valid JSON body', async () => {
    const result = await readOptionalJsonBody<{ refreshToken: string }>(
      createRequest('{"refreshToken":"token"}', 'application/json')
    );

    expect(result).toEqual({ refreshToken: 'token' });
  });

  test('throws AppError for malformed JSON', async () => {
    expect.assertions(3);

    try {
      await readOptionalJsonBody(createRequest('{', 'application/json'));
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe('VALIDATION_ERROR');
      expect((error as AppError).statusCode).toBe(400);
    }
  });
});
