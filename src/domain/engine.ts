import {
  differenceInCalendarDays,
  format,
  startOfWeek,
  startOfDay,
  subDays,
} from "date-fns";
import type { Data, Difficulty, Session, Workout } from "./model";
import { coreIds, getGame } from "../games/registry";
export const localDay = (date = new Date()) => format(date, "yyyy-MM-dd");
export const sessionDay = (s: Session) =>
  s.dateKey ?? localDay(new Date(s.end));
export function seeded(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function shuffle<T>(list: T[], r = Math.random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export const rank = (d: Difficulty) => ["Easy", "Normal", "Hard"].indexOf(d);
export const accuracy = (correct: number, attempts: number) =>
  [correct, attempts].every(Number.isFinite) && attempts > 0
    ? Math.max(0, Math.min(100, (correct / attempts) * 100))
    : 0;
export function score(correct: number, attempts: number, seconds: number) {
  if (
    ![correct, attempts, seconds].every(Number.isFinite) ||
    correct < 0 ||
    attempts < 0 ||
    correct > attempts ||
    seconds < 0
  )
    return 0;
  return Math.round(
    Math.min(
      100,
      accuracy(correct, attempts) * 0.9 +
        (correct > 0 ? Math.min(10, (correct / Math.max(1, seconds)) * 10) : 0),
    ),
  );
}
// Version 2: accuracy and speed are bounded by how much of the exercise was completed.
export function gameScore(
  gameId: string,
  difficulty: Difficulty,
  correct: number,
  attempts: number,
  seconds: number,
  metrics: Record<string, number> = {},
) {
  if (gameId === "reaction")
    return Number.isFinite(metrics.averageMs) && metrics.averageMs >= 80
      ? Math.round(
          Math.max(0, Math.min(100, 100 - (metrics.averageMs - 150) / 8)),
        )
      : 0;
  const targets: Record<string, number> = {
    math: 10,
    logic: 8,
    focus: [4, 6, 9][rank(difficulty)] * 3,
    numbers: 5,
    words: 8,
    spatial: 8,
    nback: 16,
    color: 12,
    sequence: 8,
  };
  const coverage =
    gameId === "memory"
      ? (metrics.span ?? 0) / (7 + rank(difficulty))
      : correct / (targets[gameId] ?? Infinity);
  return Math.max(
    0,
    Math.round(
      score(correct, attempts, seconds) * Math.max(0, Math.min(1, coverage)),
    ) - (gameId === "words" ? (metrics.hintsUsed ?? 0) * 5 : 0),
  );
}
export function numericAnswer(value: string, answer: string) {
  return (
    /^[+-]?\d+$/.test(value.trim()) &&
    Number.isSafeInteger(Number(value)) &&
    Number(value) === Number(answer)
  );
}
export interface Question {
  prompt: string;
  answer: string;
  choices: string[];
  explanation: string;
  hint?: string;
  ink?: string;
}
export function choices(answer: number, r = Math.random) {
  const offsets = shuffle(
    Array.from({ length: 18 }, (_, i) => (i < 9 ? i - 9 : i - 8)),
    r,
  ).slice(0, 3);
  return shuffle([answer, ...offsets.map((v) => answer + v)].map(String), r);
}
export function mathQuestion(d: Difficulty, r = Math.random): Question {
  const n = rank(d),
    max = [10, 30, 90][n],
    a = 1 + Math.floor(r() * max),
    b = 1 + Math.floor(r() * (n + 1) * 6),
    op = Math.floor(r() * 4);
  let answer: number, prompt: string;
  if (op === 0) {
    answer = a + b;
    prompt = `${a} + ${b}`;
  } else if (op === 1) {
    answer = a - b;
    prompt = `${a} − ${b}`;
  } else if (op === 2) {
    answer = a * b;
    prompt = `${a} × ${b}`;
  } else {
    answer = a;
    prompt = `${a * b} ÷ ${b}`;
  }
  return {
    prompt,
    answer: String(answer),
    choices: [],
    explanation: `${prompt} = ${answer}`,
  };
}
export function patternQuestion(d: Difficulty, r = Math.random): Question {
  const start = 1 + Math.floor(r() * 12),
    step = 2 + Math.floor(r() * (rank(d) + 1) * 4),
    kind = Math.floor(r() * (rank(d) + 1));
  let nums: number[], answer: number, explanation: string;
  if (kind === 1) {
    nums = [start, start * 2, start * 4, start * 8];
    answer = start * 16;
    explanation = "Multiply each number by 2.";
  } else if (kind === 2) {
    nums = [start, start + step, start + step + 1, start + step * 2 + 1];
    answer = start + step * 2 + 2;
    explanation = `Alternate adding ${step} and 1.`;
  } else {
    nums = [start, start + step, start + 2 * step, start + 3 * step];
    answer = start + 4 * step;
    explanation = `Add ${step} each time.`;
  }
  return {
    prompt: nums.join("   ·   ") + "   ·   ?",
    answer: String(answer),
    choices: choices(answer, r),
    explanation,
  };
}
export function dailyWorkout(data: Data, date = localDay()): Workout {
  const existing = data.workouts.find((w) => w.date === date);
  if (existing) return existing;
  const ids = shuffle(coreIds, seeded(date));
  ids.sort(
    (a, b) =>
      Number(data.profile.categories.includes(getCategory(b))) -
      Number(data.profile.categories.includes(getCategory(a))),
  );
  return {
    id: `daily-${date}`,
    date,
    games: ids,
    sessionIds: [],
    difficulty: data.profile.difficulty,
    completed: false,
  };
}
function getCategory(id: string) {
  return getGame(id).category;
}
export function streak(sessions: Session[], today = new Date()) {
  const days = [
    ...new Set(
      sessions
        .filter((s) => sessionDay(s) <= localDay(today))
        .map((s) => sessionDay(s)),
    ),
  ]
    .sort()
    .reverse();
  if (
    !days.length ||
    differenceInCalendarDays(today, new Date(days[0] + "T12:00:00")) > 1
  )
    return 0;
  let count = 1;
  for (let i = 1; i < days.length; i++) {
    if (
      differenceInCalendarDays(
        new Date(days[i - 1] + "T12:00:00"),
        new Date(days[i] + "T12:00:00"),
      ) !== 1
    )
      break;
    count++;
  }
  return count;
}
export function best(sessions: Session[], gameId: string) {
  let list = sessions.filter((s) => s.gameId === gameId);
  if (
    !["memory", "reaction"].includes(gameId) &&
    list.some((s) => s.scoringVersion === 2)
  )
    list = list.filter((s) => s.scoringVersion === 2);
  return list.sort(
    (a, b) =>
      recordMetric(b) - recordMetric(a) ||
      Date.parse(a.end) - Date.parse(b.end),
  )[0];
}
function recordMetric(s: Session) {
  return s.gameId === "reaction"
    ? -(s.metrics.averageMs ?? Infinity)
    : s.gameId === "memory"
      ? (s.metrics.span ?? 0)
      : s.score;
}

export function achievements(data: Data) {
  return [
    {
      id: "first",
      name: "First step",
      description: "Complete your first exercise",
      target: 1,
      value: data.sessions.length,
    },
    {
      id: "perfect",
      name: "Perfect round",
      description: "Finish an exercise with 100% accuracy",
      target: 1,
      value: data.sessions.filter((s) => s.accuracy === 100).length,
    },
    {
      id: "memory",
      name: "Memory milestone",
      description: "Recall a sequence of six tiles",
      target: 6,
      value: data.sessions
        .filter((s) => s.gameId === "memory")
        .reduce((max, s) => Math.max(max, s.metrics.span || 0), 0),
    },
    {
      id: "reflex",
      name: "Sharp reflexes",
      description: "Average under 350 ms in Reaction Test",
      target: 1,
      value: data.sessions.filter(
        (s) => s.gameId === "reaction" && s.metrics.averageMs < 350,
      ).length,
    },
    {
      id: "explorer",
      name: "Curious mind",
      description: "Try five different exercises",
      target: 5,
      value: new Set(data.sessions.map((s) => s.gameId)).size,
    },
    {
      id: "weekly",
      name: "Weekly warrior",
      description: "Train on seven different days",
      target: 7,
      value: new Set(data.sessions.map((s) => sessionDay(s))).size,
    },
    {
      id: "consistent",
      name: "Showing up",
      description: "Complete thirty exercises",
      target: 30,
      value: data.sessions.length,
    },
  ].map((a) => ({
    ...a,
    unlocked: a.value >= a.target,
    timestamp: a.value >= a.target ? unlockDate(data, a.id) : undefined,
  }));
}
function unlockDate(data: Data, id: string) {
  const ordered = [...data.sessions].sort(
    (a, b) => Date.parse(a.end) - Date.parse(b.end),
  );
  const days = new Set<string>(),
    ids = new Set<string>();
  for (let i = 0; i < ordered.length; i++) {
    const s = ordered[i];
    days.add(sessionDay(s));
    ids.add(s.gameId);
    if (
      id === "first" ||
      (id === "perfect" && s.accuracy === 100) ||
      (id === "memory" && s.gameId === "memory" && s.metrics.span >= 6) ||
      (id === "reflex" &&
        s.gameId === "reaction" &&
        s.metrics.averageMs < 350) ||
      (id === "explorer" && ids.size >= 5) ||
      (id === "weekly" && days.size >= 7) ||
      (id === "consistent" && i >= 29)
    )
      return s.end;
  }
  return undefined;
}
export function challenges(data: Data, date = new Date()) {
  const day = localDay(date),
    week = localDay(startOfWeek(date, { weekStartsOn: 1 })),
    daily = data.sessions.filter((s) => sessionDay(s) === day),
    weekly = data.sessions.filter(
      (s) => sessionDay(s) >= week && sessionDay(s) <= day,
    );
  return [
    {
      period: "daily",
      id: `day-${day}`,
      name: "A little every day",
      description: "Complete 3 exercises today",
      value: daily.length,
      target: 3,
      game: "memory",
    },
    {
      period: "daily",
      id: `accuracy-${day}`,
      name: "Precision practice",
      description: "Reach 90% accuracy in Quick Math today",
      value: daily.some((s) => s.gameId === "math" && s.accuracy >= 90) ? 1 : 0,
      target: 1,
      game: "math",
    },
    {
      period: "weekly",
      id: `week-${week}`,
      name: "Make room for practice",
      description: "Train on 5 days this week",
      value: new Set(weekly.map((s) => sessionDay(s))).size,
      target: 5,
      game: "logic",
    },
    {
      period: "weekly",
      id: `memory-${week}`,
      name: "Keep it in mind",
      description: "Complete 3 memory exercises this week",
      value: weekly.filter((s) => s.category === "Memory").length,
      target: 3,
      game: "memory",
    },
  ];
}
export function xp(data: Data) {
  const dayCounts: Record<string, number> = {};
  let total = 0;
  const records = new Map<string, number>();
  for (const s of [...data.sessions].sort(
    (a, b) => Date.parse(a.end) - Date.parse(b.end),
  )) {
    const key = sessionDay(s) + s.gameId;
    dayCounts[key] = (dayCounts[key] || 0) + 1;
    total += dayCounts[key] <= 5 ? 20 + Math.floor(s.accuracy / 10) : 5;
    const recordKey =
        s.gameId +
        (["memory", "reaction"].includes(s.gameId)
          ? ""
          : (s.scoringVersion ?? 1)),
      metric = recordMetric(s);
    if (!records.has(recordKey) || metric > records.get(recordKey)!) {
      total += 10;
      records.set(recordKey, metric);
    }
  }
  const rewardIds = new Set<string>();
  for (const date of new Set(data.sessions.map((s) => sessionDay(s)))) {
    for (const c of challenges(data, new Date(date + "T23:59:59")))
      if (c.value >= c.target) rewardIds.add(c.id);
  }
  return (
    total +
    data.workouts.filter((w) => w.completed).length * 100 +
    achievements(data).filter((a) => a.unlocked).length * 25 +
    rewardIds.size * 30
  );
}
export const level = (points: number) => {
  const value = Math.floor(Math.sqrt(points / 100)) + 1;
  return {
    value,
    progress: points - 100 * (value - 1) ** 2,
    needed: 100 * value ** 2 - 100 * (value - 1) ** 2,
  };
};
export function recordSession(data: Data, s: Session): Data {
  if (data.sessions.some((x) => x.id === s.id)) return data;
  if (s.workoutId) {
    const w = data.workouts.find((w) => w.id === s.workoutId);
    if (
      !w ||
      w.completed ||
      w.games[w.sessionIds.length] !== s.gameId ||
      w.difficulty !== s.difficulty
    )
      return data;
  }
  const next = { ...data, sessions: [...data.sessions, s] };
  if (s.workoutId)
    next.workouts = data.workouts.map((w) => {
      if (
        w.id !== s.workoutId ||
        w.sessionIds.length >= w.games.length ||
        w.games[w.sessionIds.length] !== s.gameId
      )
        return w;
      const sessionIds = [...w.sessionIds, s.id];
      return {
        ...w,
        sessionIds,
        completed: sessionIds.length === w.games.length,
      };
    });
  return next;
}

export function logicQuestion(d: Difficulty, r = Math.random): Question {
  const kind = Math.floor(r() * 5);
  if (kind === 0) return patternQuestion(d, r);
  if (kind === 1) {
    const cycle = shuffle(["○", "△", "□", "◇"], r).slice(0, 3);
    return {
      prompt: `Repeat the group: ${[...cycle, ...cycle].join(" ")}  ?`,
      answer: cycle[0],
      choices: shuffle(["○", "△", "□", "◇"], r),
      explanation: `Repeat ${cycle.join(" → ")}. The next symbol is ${cycle[0]}.`,
    };
  }
  if (kind === 2) {
    const divisor = [2, 3, 5][rank(d)],
      base = 2 + Math.floor(r() * 8),
      values = Array.from({ length: 4 }, (_, i) => (base + i) * divisor),
      index = Math.floor(r() * 4);
    values[index] += 1;
    return {
      prompt: `Which number is NOT a multiple of ${divisor}?`,
      answer: String(values[index]),
      choices: shuffle(values.map(String), r),
      explanation: `${values[index]} leaves a remainder of 1 when divided by ${divisor}. All the others divide exactly.`,
    };
  }
  if (kind === 3) {
    const factor = 2 + rank(d),
      a = 2 + Math.floor(r() * 6),
      b = a + 3,
      c = b + 2,
      answer = c * factor;
    return {
      prompt: `Same multiplier: ${a} → ${a * factor}, ${b} → ${b * factor}, ${c} → ?`,
      answer: String(answer),
      choices: choices(answer, r),
      explanation: `Multiply each input by ${factor}: ${c} × ${factor} = ${answer}.`,
    };
  }
  const start = 1 + Math.floor(r() * 20),
    step = 2 + Math.floor(r() * 7),
    answer = start + step * 2;
  return {
    prompt: `Constant step: ${start} · ${start + step} · ? · ${start + step * 3} · ${start + step * 4}`,
    answer: String(answer),
    choices: choices(answer, r),
    explanation: `Add ${step} each time. The missing value is ${answer}.`,
  };
}

export function filteredSessions(
  sessions: Session[],
  filters: {
    range: string;
    game: string;
    category: string;
    difficulty: string;
  },
  now = new Date(),
) {
  const first =
    filters.range === "All"
      ? "0000-00-00"
      : localDay(
          startOfDay(subDays(now, Math.max(0, Number(filters.range) - 1))),
        );
  return sessions.filter(
    (s) =>
      sessionDay(s) >= first &&
      sessionDay(s) <= localDay(now) &&
      (filters.game === "All" || s.gameId === filters.game) &&
      (filters.category === "All" || s.category === filters.category) &&
      (filters.difficulty === "All" || s.difficulty === filters.difficulty),
  );
}
