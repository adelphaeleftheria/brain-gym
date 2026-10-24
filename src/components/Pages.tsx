import { useState } from "react";
import { format } from "date-fns";
import { useStore } from "../app/context";
import { achievements, best, challenges, dailyWorkout } from "../domain/engine";
import { categories } from "../domain/model";
import { games, getGame } from "../games/registry";
import { Empty, GameCards, Result, SessionRows } from "./Common";
import { csv } from "../storage/db";
export function Train() {
  const [query, setQuery] = useState(""),
    [cat, setCat] = useState("All");
  const { play } = useStore();
  const selected = games.filter(
    (g) =>
      (cat === "All" || g.category === cat) &&
      `${g.name} ${g.description}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <PageTitle
        eyebrow="YOUR MENTAL TOOLKIT"
        title="Find your next challenge."
        text="Eleven ways to practice. One small step at a time."
      />
      <div className="filters">
        <input
          aria-label="Search exercises"
          placeholder="Search exercises…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="Category"
          value={cat}
          onChange={(e) => setCat(e.target.value)}
        >
          {["All", ...categories].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      {!query && cat === "All" ? (
        <GameCards />
      ) : (
        <div className="game-cards">
          {selected.map((g) => (
            <button key={g.id} className="game-card" onClick={() => play(g.id)}>
              <span className="mini-symbol">{g.symbol}</span>
              <h3>{g.name}</h3>
              <p>{g.description}</p>
              <span>Start exercise →</span>
            </button>
          ))}
        </div>
      )}
      {!selected.length && (
        <Empty
          title="No exercises found"
          text="Try a different name or category."
          action={false}
        />
      )}
    </>
  );
}
export function PageTitle({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
    </header>
  );
}
export function WorkoutPage() {
  const { data, play, openResult } = useStore(),
    w = dailyWorkout(data),
    list = w.sessionIds
      .map((id) => data.sessions.find((s) => s.id === id)!)
      .filter(Boolean);
  return (
    <>
      <PageTitle
        eyebrow="ONE DAY AT A TIME"
        title={w.completed ? "You showed up. Well done." : "The Daily Mix"}
        text={`${format(new Date(), "EEEE, MMMM d")} · Five exercises · Approximately 5–10 minutes`}
      />
      <div className="workout-layout">
        <section className="panel">
          <div className="section-title">
            <h2>{w.completed ? "Workout complete" : "Your session plan"}</h2>
            <span>{w.sessionIds.length}/5</span>
          </div>
          <div className="progress-track">
            <i style={{ width: `${(w.sessionIds.length / 5) * 100}%` }} />
          </div>
          {w.games.map((id, i) => (
            <div className="workout-step" key={id}>
              <span className={i < w.sessionIds.length ? "step done" : "step"}>
                {i < w.sessionIds.length ? "✓" : `0${i + 1}`}
              </span>
              <div>
                <h3>{getGame(id).name}</h3>
                <p>
                  {getGame(id).category} · {w.difficulty}
                </p>
              </div>
              {i < w.sessionIds.length ? (
                <button onClick={() => openResult(list[i])}>Result ↗</button>
              ) : i === w.sessionIds.length ? (
                <button className="primary" onClick={() => play(id, true)}>
                  {i ? "Continue" : "Start"} →
                </button>
              ) : (
                <span className="muted">Up next</span>
              )}
            </div>
          ))}
        </section>
        <aside className="panel">
          <span className="eyebrow">YOUR OWN PACE</span>
          <h2>
            {w.completed ? "Small steps add up." : "Make this time yours."}
          </h2>
          <p>
            You can leave between exercises. Your completed exercises are saved
            automatically, ready when you are.
          </p>
          <p className="muted">
            Keep the tab visible during timed exercises. An interrupted exercise
            can be restarted without losing earlier progress.
          </p>
          {w.completed && (
            <>
              <div className="stats-grid">
                <div>
                  <small>Total score</small>
                  <strong>{list.reduce((a, s) => a + s.score, 0)}</strong>
                </div>
                <div>
                  <small>Accuracy</small>
                  <strong>
                    {Math.round(
                      (list.reduce((a, s) => a + s.correct, 0) /
                        Math.max(
                          1,
                          list.reduce((a, s) => a + s.attempts, 0),
                        )) *
                        100,
                    )}
                    %
                  </strong>
                </div>
                <div>
                  <small>Duration</small>
                  <strong>
                    {Math.round(
                      list.reduce((a, s) => a + s.duration, 0) / 1000,
                    )}
                    s
                  </strong>
                </div>
              </div>
              <p>100 workout XP earned, plus exercise and milestone rewards.</p>
              {data.workouts.filter((x) => x.completed).length > 1 && (
                <p>
                  {data.workouts.filter((x) => x.completed).length} workouts
                  completed so far.
                </p>
              )}
            </>
          )}
        </aside>
      </div>
    </>
  );
}
export function Challenges() {
  const { data, play } = useStore();
  return (
    <>
      <PageTitle
        eyebrow="A LITTLE EXTRA MOTIVATION"
        title="Something to work toward."
        text="Local daily and weekly challenges. No leaderboards. Just your own progress."
      />
      <div className="challenge-grid">
        {challenges(data).map((c) => (
          <section className="panel" key={c.id}>
            <span className="eyebrow">
              {c.period === "daily" ? "DAILY" : "WEEKLY"} · 30 XP
            </span>
            <h2>{c.name}</h2>
            <p>{c.description}</p>
            <div className="progress-track">
              <i
                style={{
                  width: `${Math.min(100, (c.value / c.target) * 100)}%`,
                }}
              />
            </div>
            <div className="section-title">
              <span>
                {Math.min(c.target, c.value)} / {c.target}
              </span>
              {c.value >= c.target ? (
                <span className="success">✓ Complete</span>
              ) : (
                <button onClick={() => play(c.game)}>Train now →</button>
              )}
            </div>
          </section>
        ))}
        <section className="panel">
          <span className="eyebrow">PERSONAL BEST</span>
          <h2>Your next benchmark</h2>
          <p>
            {best(data.sessions, "logic")
              ? `Beat your Pattern Logic record of ${best(data.sessions, "logic")!.score}/100.`
              : "Play Pattern Logic to establish your first benchmark."}
          </p>
          <button onClick={() => play("logic")}>Try Pattern Logic →</button>
        </section>
      </div>
    </>
  );
}
export function Achievements() {
  const { data } = useStore();
  return (
    <>
      <PageTitle
        eyebrow="THE LITTLE MILESTONES"
        title="Effort worth recognizing."
        text="Earned through practice. Every milestone has a clear goal."
      />
      <div className="challenge-grid">
        {achievements(data).map((a, i) => (
          <section
            className={`panel achievement ${a.unlocked ? "unlocked" : ""}`}
            key={a.id}
          >
            <span className="achievement-symbol">
              {["✳", "◇", "▦", "ϟ", "↗", "◉", "✧"][i]}
            </span>
            <span className="eyebrow">
              {a.unlocked ? "UNLOCKED · 25 XP" : "IN PROGRESS"}
            </span>
            <h2>{a.name}</h2>
            <p>{a.description}</p>
            <div className="progress-track">
              <i
                style={{
                  width: `${Math.min(100, (a.value / a.target) * 100)}%`,
                }}
              />
            </div>
            <small>
              {Math.min(a.value, a.target)} / {a.target}
              {a.timestamp
                ? ` · ${new Date(a.timestamp).toLocaleDateString()}`
                : ""}
            </small>
          </section>
        ))}
      </div>
    </>
  );
}
export function History() {
  const { data } = useStore();
  const [query, setQuery] = useState(""),
    [difficulty, setDifficulty] = useState("All"),
    [sort, setSort] = useState("Recent"),
    [page, setPage] = useState(0);
  const list = data.sessions
    .filter(
      (s) =>
        (difficulty === "All" || s.difficulty === difficulty) &&
        `${getGame(s.gameId).name} ${s.category}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "Score"
        ? b.score - a.score
        : Date.parse(b.end) - Date.parse(a.end),
    );
  return (
    <>
      <PageTitle
        eyebrow="YOUR PRACTICE JOURNAL"
        title="Every session counts."
        text="A record of showing up, trying things, and finding your rhythm."
      />
      <div className="filters">
        <input
          aria-label="Search history"
          placeholder="Search game or category…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
        />
        <select
          aria-label="History difficulty"
          value={difficulty}
          onChange={(e) => {
            setDifficulty(e.target.value);
            setPage(0);
          }}
        >
          {["All", "Easy", "Normal", "Hard"].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <select
          aria-label="Sort history"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option>Recent</option>
          <option>Score</option>
        </select>
        <button onClick={() => csv(data)}>Export CSV ↓</button>
      </div>
      <section className="panel">
        {list.length ? (
          <>
            <SessionRows sessions={list.slice(page * 25, (page + 1) * 25)} />
            <div className="section-title">
              <button disabled={!page} onClick={() => setPage(page - 1)}>
                Previous
              </button>
              <small>
                {page + 1} / {Math.ceil(list.length / 25)}
              </small>
              <button
                disabled={(page + 1) * 25 >= list.length}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </div>
          </>
        ) : (
          <Empty />
        )}
      </section>
    </>
  );
}

export { Result };
