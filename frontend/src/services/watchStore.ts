// In-memory store tracking which video parts have been watched per topic.
// Resets when the app is fully restarted, which is fine for the demo flow.

const store: Record<string, boolean[]> = {};

export function markWatched(topicId: string, index: number): void {
  if (!store[topicId]) store[topicId] = Array(6).fill(false);
  store[topicId][index] = true;
}

export function getWatchedCount(topicId: string): number {
  return (store[topicId] ?? []).filter(Boolean).length;
}

export function isAllWatched(topicId: string): boolean {
  const w = store[topicId];
  return !!w && w.length === 6 && w.every(Boolean);
}
