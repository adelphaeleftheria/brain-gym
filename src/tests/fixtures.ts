import type { Session } from "../domain/model";
export const makeSession = (overrides: Partial<Session> = {}): Session => ({
  id: crypto.randomUUID(),
  gameId: "math",
  category: "Math",
  difficulty: "Normal",
  start: "2026-10-24T10:00:00Z",
  end: "2026-10-24T10:01:00Z",
  duration: 60000,
  rawScore: 9,
  score: 82,
  accuracy: 90,
  attempts: 10,
  correct: 9,
  status: "completed",
  metrics: {},
  ...overrides,
});
