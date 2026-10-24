import { describe, it, expect } from "vitest";
import {
  accuracy,
  score,
  mathQuestion,
  logicQuestion,
  patternQuestion,
  seeded,
  dailyWorkout,
  recordSession,
  streak,
  level,
  xp,
  challenges,
  achievements,
} from "../domain/engine";
import { defaults, type Session } from "../domain/model";
import { BrainDB, validateBackup, mergeData } from "../storage/db";
import { rotate } from "../games/Play";
export function session(overrides: Partial<Session> = {}): Session {
  return {
    id: "one",
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
  };
}
describe("generators and scoring", () => {
  it("generates integer arithmetic with valid answers at every difficulty", () => {
    for (const d of ["Easy", "Normal", "Hard"] as const) {
      const r = seeded(d);
      for (let i = 0; i < 300; i++) {
        const q = mathQuestion(d, r);
        const [a, op, b] = q.prompt.split(" ");
        const result =
          op === "+"
            ? +a + +b
            : op === "−"
              ? +a - +b
              : op === "×"
                ? +a * +b
                : +a / +b;
        expect(+q.answer).toBe(result);
        expect(Number.isInteger(result)).toBe(true);
      }
    }
  });
  it("patterns have exactly one correct and four unique choices", () => {
    for (const d of ["Easy", "Normal", "Hard"] as const) {
      const r = seeded(d);
      for (let i = 0; i < 300; i++) {
        const q = patternQuestion(d, r);
        expect(q.choices.filter((x) => x === q.answer)).toHaveLength(1);
        expect(new Set(q.choices).size).toBe(4);
        expect(q.explanation.length).toBeGreaterThan(5);
      }
    }
  });
  it("is reproducible and clamps accuracy and score", () => {
    expect(patternQuestion("Hard", seeded("x"))).toEqual(
      patternQuestion("Hard", seeded("x")),
    );
    expect(accuracy(0, 0)).toBe(0);
    expect(score(0, 10, 1)).toBe(0);
    expect(score(10, 10, 0)).toBe(100);
    expect(score(1, 10, 1)).toBeLessThan(score(9, 10, 100));
  });
  it("rotations preserve shape and are distinct", () => {
    const a = [1, 0, 0, 1, 1, 0, 0, 1, 1];
    expect(rotate(a, 4)).toEqual(a);
    expect(new Set([0, 1, 2, 3].map((n) => rotate(a, n).join(""))).size).toBe(
      4,
    );
  });
});
describe("workouts and progression", () => {
  it("checkpoints each exercise once and survives serialization", () => {
    let d = defaults();
    const w = dailyWorkout(d, "2026-10-24");
    d.workouts = [w];
    const s = session({ gameId: w.games[0], workoutId: w.id });
    d = recordSession(d, s);
    expect(d.workouts[0].sessionIds).toEqual(["one"]);
    expect(recordSession(d, s)).toEqual(d);
    expect(JSON.parse(JSON.stringify(d)).workouts[0].sessionIds.length).toBe(1);
    expect(dailyWorkout(d, "2026-10-24")).toEqual(d.workouts[0]);
  });
  it("handles streak gaps and level thresholds", () => {
    expect(streak([session()], new Date("2026-10-25T12:00:00"))).toBe(1);
    expect(streak([session()], new Date("2026-10-26T12:00:00"))).toBe(0);
    expect(level(100).value).toBe(2);
  });
});
describe("storage and backups", () => {
  it("persists IndexedDB state", async () => {
    const db = new BrainDB("test-" + crypto.randomUUID());
    await db.state.put({ id: "main", data: defaults() });
    expect((await db.state.get("main"))?.data.version).toBe(1);
    await db.delete();
  });
  it("validates before restoring and rejects corruption and duplicate IDs", () => {
    const d = defaults();
    d.sessions = [session()];
    expect(validateBackup({ version: 1, data: d })).toEqual(d);
    expect(() => validateBackup({ ...d, version: 99 })).toThrow();
    expect(() =>
      validateBackup({ ...d, sessions: [session(), session()] }),
    ).toThrow();
    expect(() =>
      validateBackup({ ...d, sessions: [session({ score: Infinity })] }),
    ).toThrow();
    expect(mergeData(d, d).sessions).toHaveLength(1);
  });
});
it("generators terminate even with a constant random source", () => {
  expect(new Set(patternQuestion("Normal", () => 0.1).choices).size).toBe(4);
});
it("challenge XP is retained after its calendar day and rewards are deduplicated", () => {
  const d = defaults();
  d.sessions = [
    session({ id: "1" }),
    session({ id: "2" }),
    session({ id: "3" }),
  ];
  const before = xp(d);
  expect(
    challenges(d, new Date("2026-10-24T23:00:00")).filter(
      (c) => c.value >= c.target,
    ).length,
  ).toBeGreaterThan(0);
  const withoutChallenge = { ...d, sessions: d.sessions.slice(0, 2) };
  expect(before - xp(withoutChallenge)).toBeGreaterThanOrEqual(30);
  expect(
    xp({
      ...d,
      sessions: [
        ...d.sessions,
        session({
          id: "next-day",
          start: "2026-10-25T10:00:00Z",
          end: "2026-10-25T10:01:00Z",
        }),
      ],
    }),
  ).toBeGreaterThan(before);
  expect(achievements(d).find((a) => a.id === "first")?.timestamp).toBe(
    d.sessions[0].end,
  );
  const result = recordSession(d, d.sessions[0]);
  expect(xp(result)).toBe(before);
});

it("logic templates have exactly one defensible correct choice", () => {
  for (const difficulty of ["Easy", "Normal", "Hard"] as const) {
    const r = seeded(difficulty);
    for (let i = 0; i < 500; i++) {
      const q = logicQuestion(difficulty, r);
      expect(q.choices).toHaveLength(4);
      expect(new Set(q.choices).size).toBe(4);
      expect(q.choices.filter((v) => v === q.answer)).toHaveLength(1);
      expect(q.explanation.length).toBeGreaterThan(10);
    }
  }
});
