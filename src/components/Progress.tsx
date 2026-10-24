import { PageTitle } from "./Pages";
import { useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { format, subDays } from "date-fns";
import { useStore } from "../app/context";
import {
  filteredSessions,
  best,
  localDay,
  sessionDay,
  streak,
  xp,
} from "../domain/engine";
import { categories } from "../domain/model";
import { games } from "../games/registry";
import { Empty } from "./Common";
export default function Progress() {
  const { data } = useStore();
  const [range, setRange] = useState("30"),
    [game, setGame] = useState("All"),
    [cat, setCat] = useState("All"),
    [diff, setDiff] = useState("All");
  const list = filteredSessions(data.sessions, {
    range,
    game,
    category: cat,
    difficulty: diff,
  });
  const chart = [...list]
    .sort((a, b) => Date.parse(a.end) - Date.parse(b.end))
    .map((s, i) => ({
      name: String(i + 1),
      accuracy: Math.round(s.accuracy),
      reaction: s.metrics.averageMs,
      date: format(new Date(s.end), "MMM d"),
    }));
  return (
    <>
      <PageTitle
        eyebrow="MEASURED IN SMALL STEPS"
        title="See your practice take shape."
        text="Real sessions. Your own benchmarks. Progress within each exercise."
      />
      <div className="filters">
        <select
          aria-label="Date range"
          value={range}
          onChange={(e) => setRange(e.target.value)}
        >
          {["7", "30", "90", "All"].map((v) => (
            <option value={v} key={v}>
              {v === "All" ? "All time" : `${v} days`}
            </option>
          ))}
        </select>
        <select
          aria-label="Progress game"
          value={game}
          onChange={(e) => setGame(e.target.value)}
        >
          <option value="All">All games</option>
          {games.map((g) => (
            <option value={g.id} key={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Progress category"
          value={cat}
          onChange={(e) => setCat(e.target.value)}
        >
          {["All", ...categories].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <select
          aria-label="Progress difficulty"
          value={diff}
          onChange={(e) => setDiff(e.target.value)}
        >
          {["All", "Easy", "Normal", "Hard"].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </div>
      <div className="summary-stats">
        {[
          ["Sessions", list.length],
          [
            "Training minutes",
            Math.round(list.reduce((a, s) => a + s.duration, 0) / 60000),
          ],
          ["Total XP (all time)", xp(data)],
          ["Current day streak", streak(data.sessions)],
          [
            "Daily workouts (all time)",
            data.workouts.filter((w) => w.completed).length,
          ],
        ].map(([label, value]) => (
          <div className="panel" key={label}>
            <small>{label}</small>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <section className="panel chart-panel">
        <div className="section-title">
          <h2>
            {game === "reaction"
              ? "Reaction time · milliseconds"
              : "Accuracy by session"}
          </h2>
          <span className="eyebrow">
            {game === "reaction" ? "LOWER IS FASTER" : "0–100%"}
          </span>
        </div>
        {list.length && game !== "All" ? (
          <>
            <div style={{ width: "100%", height: 260 }}>
              <ResponsiveContainer>
                <LineChart data={chart}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" stroke="var(--muted)" />
                  <YAxis
                    domain={game === "reaction" ? ["auto", "auto"] : [0, 100]}
                    stroke="var(--muted)"
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      color: "var(--text)",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey={game === "reaction" ? "reaction" : "accuracy"}
                    stroke="var(--accent)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="muted">
              Each point is one recorded session.{" "}
              {game === "All"
                ? "Choose a single game for a meaningful within-game comparison."
                : ""}
            </p>
          </>
        ) : (
          <Empty
            title={
              game === "All"
                ? "Choose an exercise to view its trend"
                : "Your progress starts here"
            }
            text={
              game === "All"
                ? "Different games measure different tasks. Select one game above for a meaningful comparison."
                : "Complete this exercise to create your first result."
            }
            action={game !== "All"}
          />
        )}
      </section>
      <div className="two-columns">
        <section className="panel">
          <h2>Practice by category</h2>
          {categories.map((c) => {
            const group = list.filter((s) => s.category === c);
            return (
              <div className="category-row" key={c}>
                <span>{c}</span>
                <div className="progress-track">
                  <i
                    style={{
                      width: `${group.length ? group.reduce((a, s) => a + s.score, 0) / group.length : 0}%`,
                    }}
                  />
                </div>
                <small>
                  {group.length ? `${group.length} sessions` : "No sessions"}
                </small>
              </div>
            );
          })}
        </section>
        <section className="panel">
          <h2>Last 90 days</h2>
          <p className="muted">
            Every lit square is a day you practiced (all games, last 90 days).
          </p>
          <div className="heatmap">
            {Array.from({ length: 90 }, (_, i) =>
              localDay(subDays(new Date(), 89 - i)),
            ).map((day) => (
              <span
                key={day}
                title={`${day}: ${data.sessions.filter((s) => sessionDay(s) === day).length} sessions`}
                className={
                  data.sessions.some((s) => sessionDay(s) === day)
                    ? "active"
                    : ""
                }
              />
            ))}
          </div>
          <h3>Your records</h3>
          {games
            .filter((g) => best(list, g.id))
            .map((g) => (
              <div className="section-title" key={g.id}>
                <span>{g.name}</span>
                <strong>
                  {g.id === "reaction"
                    ? `${Math.round(best(list, g.id)!.metrics.averageMs)} ms`
                    : g.id === "memory"
                      ? `${best(list, g.id)!.metrics.span} tiles`
                      : `${best(list, g.id)!.score}/100`}{" "}
                  <small>
                    {format(new Date(best(list, g.id)!.end), "MMM d")}
                  </small>
                </strong>
              </div>
            ))}
        </section>
      </div>
    </>
  );
}
