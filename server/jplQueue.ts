let queue: Promise<unknown> = Promise.resolve();
export function serializeJpl<T>(work: () => Promise<T>): Promise<T> {
  const result = queue.then(work); queue = result.catch(() => {}); return result;
}
