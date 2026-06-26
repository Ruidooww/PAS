export async function pollUntil<T>(
  read: () => Promise<T>,
  isReady: (value: T) => boolean,
  options: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const intervalMs = options.intervalMs ?? 500;
  const deadline = Date.now() + timeoutMs;
  let lastValue: T | undefined;

  while (Date.now() <= deadline) {
    lastValue = await read();
    if (isReady(lastValue)) return lastValue;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Timed out waiting for e2e condition. Last value: ${JSON.stringify(lastValue)}`);
}
