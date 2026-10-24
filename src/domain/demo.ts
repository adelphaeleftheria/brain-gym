import { subDays } from "date-fns";
import { defaults, type Data } from "./model";
import { localDay } from "./engine";
import { games } from "../games/registry";
export function demoData(): Data {
  const d = defaults();
  d.profile = { ...d.profile, name: "Alex", onboarded: true };
  for (let i = 0; i < 24; i++) {
    const g = games[i % games.length],
      date = subDays(new Date(), Math.floor(i / 3));
    date.setMinutes(date.getMinutes() - (i % 3) * 10);
    const start = new Date(date.getTime() - 60000);
    d.sessions.push({
      id: `demo-${i}`,
      gameId: g.id,
      category: g.category,
      difficulty: "Normal",
      start: start.toISOString(),
      end: date.toISOString(),
      dateKey: localDay(date),
      duration: 60000,
      rawScore: 8,
      score: 60 + ((i * 7) % 35),
      accuracy: 80 + (i % 3) * 10,
      attempts: 10,
      correct: 8 + (i % 3),
      status: "completed",
      metrics:
        g.id === "reaction"
          ? { averageMs: 280 + i * 5, bestMs: 240 }
          : g.id === "memory"
            ? { span: 5 }
            : g.id === "numbers"
              ? { digits: 7 }
              : {},
    });
  }
  return d;
}
