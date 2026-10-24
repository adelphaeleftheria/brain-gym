import Dexie, { liveQuery, type Table } from "dexie";
import { defaults, type Data } from "../domain/model";
import { parseISO, isValid, format } from "date-fns";
import { accuracy, gameScore } from "../domain/engine";
import { games, coreIds } from "../games/registry";
export class BrainDB extends Dexie {
  state!: Table<{ id: string; data: Data }, string>;
  constructor(name = "brain-gym") {
    super(name);
    this.version(1).stores({ state: "id" });
  }
}
export const db = new BrainDB();
export async function loadData() {
  const stored = (await db.state.get("main"))?.data;
  return stored ? validateBackup(stored) : defaults();
}
export async function saveData(data: Data) {
  await db.state.put({ id: "main", data: validateBackup(data) });
}
export async function mutateData(
  fn: (data: Data) => Data,
  database: BrainDB = db,
) {
  return database.transaction("rw", database.state, async () => {
    const stored = (await database.state.get("main"))?.data;
    const next = validateBackup(
      fn(stored ? validateBackup(stored) : defaults()),
    );
    await database.state.put({ id: "main", data: next });
    return next;
  });
}
export const observeData = (
  next: (data: Data) => void,
  error: (e: unknown) => void,
) => liveQuery(loadData).subscribe({ next, error });
const validTimestamp = (v: unknown): v is string =>
  typeof v === "string" && v.includes("T") && isValid(parseISO(v));
const validDay = (v: unknown): v is string =>
  typeof v === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  isValid(parseISO(v)) &&
  format(parseISO(v), "yyyy-MM-dd") === v;
export function validateBackup(input: unknown): Data {
  const fail = () => {
    throw new Error(
      "This is not a valid Brain Gym v1 backup. No data was changed.",
    );
  };
  if (!input || typeof input !== "object") return fail();
  const b = input as Record<string, unknown>;
  if ("data" in b && b.version !== 1) return fail();
  const d = (b.data ?? b) as Data;
  if (!d || typeof d !== "object" || Array.isArray(d)) return fail();
  if (
    d.version !== 1 ||
    !d.profile ||
    !Array.isArray(d.sessions) ||
    !Array.isArray(d.workouts) ||
    !Array.isArray(d.dismissed) ||
    !d.dismissed.every((v) => typeof v === "string")
  )
    return fail();
  const p = d.profile;
  if (
    typeof p.name !== "string" ||
    p.name.length > 80 ||
    !["Easy", "Normal", "Hard"].includes(p.difficulty) ||
    !["dark", "light", "system"].includes(p.theme) ||
    !Number.isFinite(p.duration) ||
    ![3, 5, 10, 15].includes(p.duration) ||
    !Array.isArray(p.categories) ||
    new Set(p.categories).size !== p.categories.length ||
    !p.categories.every((c) =>
      [
        "Memory",
        "Math",
        "Reaction",
        "Logic",
        "Attention",
        "Language",
        "Spatial",
      ].includes(c),
    ) ||
    !Number.isFinite(p.volume) ||
    p.volume < 0 ||
    p.volume > 1
  )
    return fail();
  for (const k of [
    "sound",
    "reducedMotion",
    "keyboardHints",
    "autoAdvance",
    "onboarded",
    "reminder",
  ] as const)
    if (typeof p[k] !== "boolean") return fail();
  const ids = new Set<string>();
  for (const s of d.sessions) {
    if (
      !s ||
      typeof s.id !== "string" ||
      !s.id.trim() ||
      s.id.length > 200 ||
      ids.has(s.id) ||
      !games.some((g) => g.id === s.gameId && g.category === s.category) ||
      !["Easy", "Normal", "Hard"].includes(s.difficulty) ||
      !validTimestamp(s.start) ||
      !validTimestamp(s.end) ||
      Date.parse(s.end) < Date.parse(s.start) ||
      s.status !== "completed" ||
      !s.metrics ||
      typeof s.metrics !== "object" ||
      Array.isArray(s.metrics) ||
      (s.workoutId !== undefined && typeof s.workoutId !== "string")
    )
      return fail();
    ids.add(s.id);
    for (const n of [
      s.duration,
      s.score,
      s.rawScore,
      s.accuracy,
      s.attempts,
      s.correct,
      ...Object.values(s.metrics),
    ])
      if (typeof n !== "number" || !Number.isFinite(n) || n < 0) return fail();
    if (s.dateKey !== undefined && !validDay(s.dateKey)) return fail();
    if (s.scoringVersion === 2) {
      if (
        !validDay(s.dateKey) ||
        s.rawScore !== s.correct ||
        s.score !==
          gameScore(
            s.gameId,
            s.difficulty,
            s.correct,
            s.attempts,
            s.duration / 1000,
            s.metrics,
          )
      )
        return fail();
      if (s.gameId === "reaction") {
        const rounds = Array.from(
          { length: 5 },
          (_, i) => s.metrics[`round${i + 1}Ms`],
        );
        if (
          rounds.some((n) => !Number.isFinite(n) || n < 80) ||
          !Number.isInteger(s.metrics.falseStarts) ||
          s.metrics.falseStarts < 0 ||
          s.correct !== 5 ||
          s.attempts !== 5 + s.metrics.falseStarts ||
          Math.abs(
            s.metrics.averageMs - rounds.reduce((a, b) => a + b, 0) / 5,
          ) > 0.00001 ||
          s.metrics.bestMs !== Math.min(...rounds) ||
          s.metrics.slowestMs !== Math.max(...rounds)
        )
          return fail();
      }
    }
    if (s.scoringVersion !== undefined && s.scoringVersion !== 2) return fail();
    if (
      s.gameId === "reaction" &&
      (!Number.isFinite(s.metrics.averageMs) || s.metrics.averageMs < 80)
    )
      return fail();
    if (
      s.gameId === "memory" &&
      (!Number.isInteger(s.metrics.span) || s.metrics.span < 0)
    )
      return fail();
    if (
      s.gameId === "numbers" &&
      (!Number.isInteger(s.metrics.digits) || s.metrics.digits < 0)
    )
      return fail();
    if (
      s.score > 100 ||
      s.accuracy > 100 ||
      s.correct > s.attempts ||
      !Number.isInteger(s.correct) ||
      !Number.isInteger(s.attempts) ||
      Math.abs(s.accuracy - accuracy(s.correct, s.attempts)) > 0.000001
    )
      return fail();
  }
  const wid = new Set<string>();
  for (const w of d.workouts) {
    if (
      !w ||
      typeof w.id !== "string" ||
      wid.has(w.id) ||
      !validDay(w.date) ||
      w.id !== `daily-${w.date}` ||
      !Array.isArray(w.games) ||
      w.games.length !== 5 ||
      new Set(w.games).size !== 5 ||
      !w.games.every((id) => coreIds.includes(id)) ||
      !w.games.every((id) => games.some((g) => g.id === id)) ||
      !Array.isArray(w.sessionIds) ||
      new Set(w.sessionIds).size !== w.sessionIds.length ||
      w.sessionIds.length > w.games.length ||
      !w.sessionIds.every((id, i) => {
        const s = d.sessions.find((s) => s.id === id);
        return (
          ids.has(id) &&
          s?.gameId === w.games[i] &&
          s.workoutId === w.id &&
          s.difficulty === w.difficulty
        );
      }) ||
      typeof w.completed !== "boolean" ||
      w.completed !== (w.sessionIds.length === w.games.length) ||
      !["Easy", "Normal", "Hard"].includes(w.difficulty)
    )
      return fail();
    wid.add(w.id);
  }
  for (const s of d.sessions)
    if (
      s.workoutId &&
      !d.workouts.some(
        (w) => w.id === s.workoutId && w.sessionIds.includes(s.id),
      )
    )
      return fail();
  return structuredClone(d);
}
export function mergeData(current: Data, incoming: Data): Data {
  validateBackup(current);
  validateBackup(incoming);
  const canonical = (v: unknown): string =>
    JSON.stringify(v, (_, value) =>
      value && typeof value === "object" && !Array.isArray(value)
        ? Object.fromEntries(
            Object.entries(value).sort(([a], [b]) => a.localeCompare(b)),
          )
        : value,
    );
  const map = new Map(current.sessions.map((s) => [s.id, s]));
  for (const session of incoming.sessions) {
    const previous = map.get(session.id);
    if (previous && canonical(previous) !== canonical(session))
      throw new Error(
        "Backups contain conflicting session IDs. No data was changed.",
      );
    map.set(session.id, session);
  }
  const sessions = [...map.values()];
  const workouts = [...current.workouts];
  for (const w of incoming.workouts) {
    const i = workouts.findIndex((x) => x.id === w.id);
    if (i < 0) workouts.push(w);
    else if (w.sessionIds.length > workouts[i].sessionIds.length)
      workouts[i] = w;
  }
  return validateBackup({
    ...current,
    sessions: sessions.map((s) =>
      s.workoutId &&
      !workouts.some((w) => w.id === s.workoutId && w.sessionIds.includes(s.id))
        ? Object.fromEntries(
            Object.entries(s).filter(([k]) => k !== "workoutId"),
          )
        : s,
    ),
    workouts,
    dismissed: [...new Set([...current.dismissed, ...incoming.dismissed])],
  });
}
export function download(
  name: string,
  text: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function backup(data: Data) {
  download(
    `brain-gym-${new Date().toISOString().slice(0, 10)}.json`,
    JSON.stringify(
      { version: 1, exportedAt: new Date().toISOString(), data },
      null,
      2,
    ),
  );
}
export function csv(data: Data) {
  const rows = [
    [
      "Game",
      "Category",
      "Date",
      "Seconds",
      "Score",
      "Accuracy",
      "Difficulty",
      "Status",
    ],
    ...data.sessions.map((s) => [
      s.gameId,
      s.category,
      s.end,
      (s.duration / 1000).toFixed(1),
      s.score,
      s.accuracy.toFixed(1),
      s.difficulty,
      s.status,
    ]),
  ];
  download(
    "brain-gym-history.csv",
    rows
      .map((r) =>
        r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(","),
      )
      .join("\n"),
    "text/csv",
  );
}
