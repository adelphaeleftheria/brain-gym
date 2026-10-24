import { describe, it, expect } from "vitest";
import {
  gameScore,
  numericAnswer,
  accuracy,
  recordSession,
  dailyWorkout,
  xp,
  challenges,
  streak,
} from "../domain/engine";
import { defaults } from "../domain/model";
import { getGame } from "../games/registry";
import { makeSession } from "./fixtures";
import { BrainDB, mutateData, validateBackup, mergeData } from "../storage/db";
describe("audit: scores and numeric input", () => {
  it("does not grant near-perfect scores for one answer followed by timeout", () => {
    expect(gameScore("math", "Normal", 1, 1, 60)).toBeLessThanOrEqual(10);
    expect(gameScore("math", "Normal", 10, 10, 60)).toBeGreaterThan(90);
    expect(gameScore("memory", "Normal", 2, 3, 15, { span: 0 })).toBe(0);
    expect(gameScore("reaction", "Normal", 5, 6, 20, { averageMs: 350 })).toBe(
      75,
    );
    expect(gameScore("math", "Hard", 0, 0, 45)).toBe(0);
  });
  it("accepts valid signed and zero-padded integers but rejects expressions and invalid input", () => {
    for (const value of [" 02 ", "+2", "2"])
      expect(numericAnswer(value, "2")).toBe(true);
    for (const value of ["", "2.0", "2e0", "2+0", "Infinity", "NaN"])
      expect(numericAnswer(value, "2")).toBe(false);
    expect(numericAnswer("-4", "-4")).toBe(true);
    expect(accuracy(NaN, 1)).toBe(0);
  });
});
describe("audit: durable workout rewards", () => {
  it("attaches a midnight-crossing result to its original workout and ignores competing completions", () => {
    let data = defaults();
    const w = dailyWorkout(data, "2026-10-23");
    data.workouts = [w];
    const first = makeSession({
      gameId: w.games[0],
      category: getGame(w.games[0]).category,
      workoutId: w.id,
      metrics:
        w.games[0] === "reaction"
          ? { averageMs: 300 }
          : w.games[0] === "memory"
            ? { span: 4 }
            : {},
    });
    data = recordSession(data, first);
    const points = xp(data);
    expect(data.workouts[0].sessionIds).toEqual([first.id]);
    expect(recordSession(data, { ...first, id: "competitor" })).toEqual(data);
    expect(xp(recordSession(data, first))).toBe(points);
    expect(validateBackup(data)).toEqual(data);
  });
  it("awards the five-step workout completion bonus exactly once", () => {
    let d = defaults();
    const w = dailyWorkout(d, "2026-10-24");
    d.workouts = [w];
    for (const id of w.games)
      d = recordSession(
        d,
        makeSession({
          gameId: id,
          category: getGame(id).category,
          workoutId: w.id,
          metrics:
            id === "reaction"
              ? { averageMs: 300 }
              : id === "memory"
                ? { span: 4 }
                : {},
        }),
      );
    expect(d.workouts[0].completed).toBe(true);
    expect(d.workouts[0].sessionIds).toHaveLength(5);
    expect(xp({ ...d, workouts: [] })).toBe(xp(d) - 100);
    expect(xp(recordSession(d, d.sessions[4]))).toBe(xp(d));
  });
  it("distinguishes weekly from daily challenges even on Monday", () => {
    const c = challenges(defaults(), new Date("2026-10-26T12:00:00"));
    expect(c.find((c) => c.id.startsWith("week-"))?.period).toBe("weekly");
  });
  it("ignores future days when computing streaks", () => {
    const today = new Date("2026-10-24T12:00:00");
    expect(
      streak(
        [makeSession(), makeSession({ end: "2026-10-28T10:00:00Z" })],
        today,
      ),
    ).toBe(1);
  });
});
describe("audit: safe persistence and restore", () => {
  it("serializes concurrent writes from separate database connections", async () => {
    const name = "audit-" + crypto.randomUUID(),
      a = new BrainDB(name),
      b = new BrainDB(name);
    try {
      await Promise.all(
        Array.from({ length: 12 }, (_, i) =>
          mutateData(
            (d) => ({
              ...d,
              sessions: [...d.sessions, makeSession({ id: String(i) })],
            }),
            i % 2 ? a : b,
          ),
        ),
      );
      const saved = (await a.state.get("main"))!.data;
      expect(saved.sessions).toHaveLength(12);
      expect(new Set(saved.sessions.map((s) => s.id)).size).toBe(12);
    } finally {
      b.close();
      await a.delete();
    }
  });
  it("rolls back invalid writes and rejects conflicting merge IDs", async () => {
    const db = new BrainDB("audit-" + crypto.randomUUID());
    try {
      await mutateData(
        (d) => ({ ...d, profile: { ...d.profile, name: "Retain me" } }),
        db,
      );
      await expect(
        mutateData((d) => ({ ...d, profile: { ...d.profile, volume: 9 } }), db),
      ).rejects.toThrow();
      expect((await db.state.get("main"))!.data.profile.name).toBe("Retain me");
    } finally {
      await db.delete();
    }
    const d = defaults();
    d.sessions = [makeSession({ id: "same" })];
    expect(() =>
      mergeData(d, { ...d, sessions: [{ ...d.sessions[0], score: 10 }] }),
    ).toThrow("conflicting");
  });
  it("rejects invalid timestamps, impossible dates, fake accuracy and missing reaction metrics", () => {
    const d = defaults();
    for (const change of [
      { end: 0 },
      { end: "2026-02-30T10:00:00Z" },
      { accuracy: 100 },
      { attempts: 1.5 },
      { id: "" },
      { gameId: "reaction", category: "Reaction", metrics: {} },
    ])
      expect(() =>
        validateBackup({ ...d, sessions: [makeSession(change as never)] }),
      ).toThrow();
    expect(() => validateBackup({ version: 99, data: d })).toThrow();
    const w = dailyWorkout(d, "2026-02-30");
    expect(() => validateBackup({ ...d, workouts: [w] })).toThrow();
  });
  it("preserves distinct histories when merging divergent copies of a daily workout", () => {
    const d = defaults(),
      w = dailyWorkout(d, "2026-10-24"),
      id = w.games[0];
    const s = makeSession({
      gameId: id,
      category: getGame(id).category,
      workoutId: w.id,
      metrics:
        id === "memory"
          ? { span: 4 }
          : id === "reaction"
            ? { averageMs: 300 }
            : {},
    });
    const a = recordSession({ ...d, workouts: [w] }, s),
      b = recordSession({ ...d, workouts: [w] }, { ...s, id: "other-copy" });
    const merged = mergeData(a, b);
    expect(merged.sessions).toHaveLength(2);
    expect(merged.workouts).toHaveLength(1);
    expect(merged.workouts[0].sessionIds).toHaveLength(1);
    expect(validateBackup(merged)).toEqual(merged);
  });
});

describe("audit: calendar and record integrity", () => {
  it("uses calendar-day ranges rather than excluding the beginning of the first day", async () => {
    const { filteredSessions } = await import("../domain/engine");
    const sessions = [
      makeSession({
        id: "in",
        dateKey: "2026-10-18",
        end: "2026-10-18T00:01:00Z",
      }),
      makeSession({
        id: "out",
        dateKey: "2026-10-17",
        end: "2026-10-17T23:59:00Z",
      }),
    ];
    expect(
      filteredSessions(
        sessions,
        { range: "7", game: "All", category: "All", difficulty: "All" },
        new Date("2026-10-24T23:00:00"),
      ).map((s) => s.id),
    ).toEqual(["in"]);
  });
  it("preserves historical local day keys and separates legacy normalized records", async () => {
    const { sessionDay, best } = await import("../domain/engine");
    expect(
      sessionDay(
        makeSession({ dateKey: "2026-10-23", end: "2026-10-24T01:00:00Z" }),
      ),
    ).toBe("2026-10-23");
    const old = makeSession({ id: "old", score: 100 }),
      recent = makeSession({ id: "new", score: 91, scoringVersion: 2 });
    expect(best([old, recent], "math")?.id).toBe("new");
  });
  it("validates the labeled sample workspace for export/restore", async () => {
    const { demoData } = await import("../domain/demo");
    expect(validateBackup(demoData()).sessions).toHaveLength(24);
  });
});
it("rejects altered version-2 scoring and reaction summaries before overwriting data", () => {
  const d = defaults(),
    s = makeSession({
      scoringVersion: 2,
      dateKey: "2026-10-24",
      rawScore: 9,
      score: gameScore("math", "Normal", 9, 10, 60),
    });
  expect(validateBackup({ ...d, sessions: [s] }).sessions).toHaveLength(1);
  expect(() =>
    validateBackup({ ...d, sessions: [{ ...s, score: 100 }] }),
  ).toThrow();
  const rx = makeSession({
    gameId: "reaction",
    category: "Reaction",
    scoringVersion: 2,
    dateKey: "2026-10-24",
    correct: 5,
    attempts: 5,
    accuracy: 100,
    rawScore: 5,
    score: 81,
    metrics: {
      averageMs: 300,
      bestMs: 300,
      slowestMs: 300,
      falseStarts: 0,
      round1Ms: 300,
      round2Ms: 300,
      round3Ms: 300,
      round4Ms: 300,
      round5Ms: 300,
    },
  });
  expect(validateBackup({ ...d, sessions: [rx] }).sessions).toHaveLength(1);
  expect(() =>
    validateBackup({
      ...d,
      sessions: [{ ...rx, metrics: { ...rx.metrics, averageMs: 80 } }],
    }),
  ).toThrow();
});
