declare module 'bun:test' {
  type MockCall = [RequestInfo | URL, RequestInit?];

  interface MockFunction {
    (...args: unknown[]): unknown;
    mock: {
      calls: MockCall[];
    };
    mockResolvedValue(value: unknown): MockFunction;
    mockImplementation(
      implementation: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    ): MockFunction;
  }

  export function describe(name: string, fn: () => void): void;
  export function test(name: string, fn: () => Promise<void> | void): void;
  export function beforeEach(fn: () => Promise<void> | void): void;
  export function afterEach(fn: () => Promise<void> | void): void;
  export function spyOn<T extends object, K extends keyof T>(object: T, key: K): MockFunction;
  export const mock: {
    restore(): void;
  };
  export function expect(value: unknown): {
    toBe(expected: unknown): void;
    toBeNull(): void;
    toEqual(expected: unknown): void;
    toHaveBeenCalledTimes(expected: number): void;
  };
}
