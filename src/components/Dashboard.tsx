import {
  ArrowRight,
  ArrowUpRight,
  Flame,
  Check,
  Clock,
  Target,
  Zap,
} from "lucide-react";
import { format, subDays } from "date-fns";
import { useStore } from "../app/context";
import {
  best,
  dailyWorkout,
  level,
  localDay,
  sessionDay,
  streak,
  xp,
} from "../domain/engine";
import { categories } from "../domain/model";
import { games, getGame } from "../games/registry";
import { Empty, GameCards, SessionRows } from "./Common";
export default function Dashboard() {
  const { data, go, play, update } = useStore(),
    w = dailyWorkout(data),
    points = xp(data),
    l = level(points),
    sessions = data.sessions;
  const hour = new Date().getHours();
  const recent = [...sessions]
    .sort((a, b) => Date.parse(b.end) - Date.parse(a.end))
    .slice(0, 3);
  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">
            {format(new Date(), "EEEE, MMMM d").toUpperCase()}
          </p>
          <h1>
            A little practice.
            <br />
            <span>A sharper day.</span>
          </h1>
          <p>
            {hour < 12
              ? "Good morning"
              : hour < 18
                ? "Good afternoon"
                : "Good evening"}
            {data.profile.name ? `, ${data.profile.name}` : ""}. Make a little
            room for your mind.
          </p>
        </div>
        <div className="streak-chip">
          <Flame size={19} />
          <strong>{streak(sessions)}</strong>
          <span>day streak</span>
        </div>
      </header>
      <div className="dashboard-top">
        <section className="workout-hero">
          <div className="hero-content">
            <span className="eyebrow">
              <span className="live-dot" /> YOUR DAILY WORKOUT
            </span>
            <h2>The Daily Mix</h2>
            <p>
              Five small challenges.
              <br />A fresh perspective.
            </p>
            <div className="hero-meta">
              <span>
                <Clock size={15} /> 5–10 min
              </span>
              <span>
                <Target size={15} /> 5 skills
              </span>
            </div>
            <button className="dark-button" onClick={() => go("workout")}>
              {w.completed
                ? "Review workout"
                : w.sessionIds.length
                  ? "Resume workout"
                  : "Start your workout"}
              <ArrowRight size={18} />
            </button>
            <small>
              {w.sessionIds.length}/5 exercises complete · Built for today
            </small>
          </div>
          <div className="orbital" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="orbit orbit-three" />
            <span className="orbit-center">✳</span>
            <span className="orbit-node">ϟ</span>
            <span className="orbit-node second">◇</span>
          </div>
        </section>
        <section className="panel week-panel">
          <div className="section-title">
            <h2>Your week, in motion</h2>
            <span className="eyebrow">THIS WEEK</span>
          </div>
          <div className="week-days">
            {Array.from({ length: 7 }, (_, i) =>
              subDays(new Date(), 6 - i),
            ).map((d) => {
              const key = localDay(d),
                active = sessions.some((s) => sessionDay(s) === key),
                complete = data.workouts.some(
                  (w) => w.date === key && w.completed,
                );
              return (
                <div key={key}>
                  <small>{format(d, "EEEEE")}</small>
                  <span
                    className={`${active ? "active" : ""} ${complete ? "complete" : ""}`}
                    title={`${key}: ${complete ? "workout complete" : active ? "some training" : "rest day"}`}
                  >
                    {complete ? (
                      <Check size={16} />
                    ) : active ? (
                      "•"
                    ) : (
                      format(d, "d")
                    )}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="muted">
            {sessions.length
              ? "Every session is a little investment in yourself."
              : "Your first session is the start of something good."}
          </p>
          <div className="level-line">
            <span className="level-icon">
              <Zap size={20} />
            </span>
            <div>
              <strong>
                Level {l.value} <small>· {points} XP total</small>
              </strong>
              <div className="progress-track">
                <i style={{ width: `${(l.progress / l.needed) * 100}%` }} />
              </div>
              <small>{l.needed - l.progress} XP to your next level</small>
            </div>
          </div>
        </section>
      </div>
      <section className="section-block">
        <div className="section-title">
          <div>
            <span className="eyebrow">A BALANCED MIND</span>
            <h2>Your training landscape</h2>
          </div>
          <button className="text-button" onClick={() => go("progress")}>
            View progress <ArrowUpRight size={16} />
          </button>
        </div>
        <div className="skill-strip">
          {categories.map((c, i) => {
            const list = sessions
              .filter((s) => s.category === c)
              .sort((a, b) => Date.parse(a.end) - Date.parse(b.end))
              .slice(-10);
            const avg = list.length
              ? Math.round(list.reduce((a, s) => a + s.score, 0) / list.length)
              : null;
            return (
              <button
                key={c}
                onClick={() => play(games.find((g) => g.category === c)!.id)}
              >
                <span className={`skill-icon tone-${i % 3}`}>
                  {["▦", "⌖", "◇", "±", "ϟ", "Aa", "◩"][i]}
                </span>
                <strong>{c}</strong>
                <span>
                  {avg === null ? "Ready to explore" : `${avg} avg. score`}
                </span>
                <div className="progress-track">
                  <i style={{ width: `${avg ?? 0}%` }} />
                </div>
              </button>
            );
          })}
        </div>
      </section>
      <section className="section-block">
        <div className="section-title">
          <div>
            <span className="eyebrow">FIND YOUR FLOW</span>
            <h2>A few minutes, well spent</h2>
          </div>
          <button className="text-button" onClick={() => go("train")}>
            All exercises <ArrowUpRight size={16} />
          </button>
        </div>
        <GameCards limit={5} />
      </section>
      <div className="two-columns">
        <section className="panel">
          <div className="section-title">
            <h2>Recent sessions</h2>
            <button className="text-button" onClick={() => go("history")}>
              View all ↗
            </button>
          </div>
          {recent.length ? (
            <SessionRows sessions={recent} />
          ) : (
            <Empty
              title="Your story is just beginning"
              text="Finish your first exercise. Your results will feel right at home here."
            />
          )}
        </section>
        <section className="panel">
          <div className="section-title">
            <h2>Personal bests</h2>
            <span>↗</span>
          </div>
          {sessions.length ? (
            <div className="record-list">
              {games.slice(0, 5).map((g) => {
                const s = best(sessions, g.id);
                return (
                  <div key={g.id}>
                    <span>{g.name}</span>
                    <strong>
                      {s
                        ? g.id === "reaction"
                          ? `${Math.round(s.metrics.averageMs)} ms`
                          : g.id === "memory"
                            ? `${s.metrics.span ?? 0} tiles`
                            : `${s.score}/100`
                        : "—"}
                    </strong>
                  </div>
                );
              })}
            </div>
          ) : (
            <Empty
              title="A benchmark, then a new best"
              text="Your personal records will appear as you train."
            />
          )}
        </section>
      </div>
      {!data.dismissed.includes("recommendation") && (
        <div className="recommendation">
          <span>✳</span>
          <div>
            <strong>A little variety goes a long way.</strong>
            <p>
              {sessions.length < 5
                ? "Explore a few different exercises to find your rhythm."
                : `Try ${getGame([...games].sort((a, b) => sessions.filter((s) => s.gameId === a.id).length - sessions.filter((s) => s.gameId === b.id).length)[0].id).name} for a change of pace.`}
            </p>
          </div>
          <button onClick={() => go("train")}>Explore exercises →</button>
          <button
            aria-label="Dismiss recommendation"
            onClick={() =>
              void update((d) => ({
                ...d,
                dismissed: [...d.dismissed, "recommendation"],
              }))
            }
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}
