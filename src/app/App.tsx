import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  Brain,
  House,
  Dumbbell,
  CalendarDays,
  Flag,
  ChartNoAxesCombined,
  Award,
  History as HistoryIcon,
  Settings as SettingsIcon,
  Search,
  ArrowLeft,
  ChevronRight,
} from "lucide-react";
import { Context } from "./context";
import {
  defaults,
  categories,
  type Data,
  type Difficulty,
  type Session,
} from "../domain/model";
import {
  dailyWorkout,
  localDay,
  recordSession,
  xp,
  level,
  achievements,
  best,
} from "../domain/engine";
import {
  mutateData,
  observeData,
  db,
  download,
  saveData,
  validateBackup,
} from "../storage/db";
import { games, getGame } from "../games/registry";
import { demoData } from "../domain/demo";
import Dashboard from "../components/Dashboard";
import {
  Achievements,
  Challenges,
  History,
  Train,
  WorkoutPage,
} from "../components/Pages";
import Settings from "../components/Settings";
import { Modal, Result } from "../components/Common";
import Play from "../games/Play";
const Progress = lazy(() => import("../components/Progress"));
const nav = [
  ["home", "Home", House],
  ["workout", "Daily Workout", CalendarDays],
  ["train", "Train", Dumbbell],
  ["challenges", "Challenges", Flag],
  ["progress", "Progress", ChartNoAxesCombined],
  ["achievements", "Achievements", Award],
  ["history", "History", HistoryIcon],
  ["settings", "Settings", SettingsIcon],
] as const;
export default function App() {
  const [data, setData] = useState<Data>(defaults),
    [ready, setReady] = useState(false),
    [fatal, setFatal] = useState(""),
    [page, setPage] = useState(location.hash.slice(1) || "home"),
    [demo, setDemoState] = useState(false),
    [sample, setSample] = useState(demoData),
    [gameId, setGameId] = useState<string | null>(null),
    [workout, setWorkout] = useState(false),
    [gameStarted, setGameStarted] = useState(false),
    [difficulty, setDifficulty] = useState<Difficulty>("Normal"),
    [result, setResult] = useState<Session | null>(null),
    [reward, setReward] = useState(""),
    [palette, setPalette] = useState(false),
    [query, setQuery] = useState(""),
    [toast, setToast] = useState("");
  const [, setCalendarDay] = useState(localDay);
  useEffect(() => {
    const refresh = () => setCalendarDay(localDay());
    const timer = setInterval(refresh, 30000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  const current = demo ? sample : data,
    ref = useRef(current),
    queue = useRef(Promise.resolve());
  const realRef = useRef(data),
    sampleRef = useRef(sample),
    activeDemo = useRef(demo),
    workoutId = useRef<string | null>(null);
  activeDemo.current = demo;
  ref.current = current;
  useEffect(() => {
    const subscription = observeData(
      (d) => {
        realRef.current = d;
        setData(d);
        setReady(true);
      },
      () => {
        setFatal(
          "Browser storage could not open or saved data is invalid. Your data has not been reset. Retry after checking browser storage, or export the stored data for recovery.",
        );
      },
    );
    return () => subscription.unsubscribe();
  }, []);
  const notify = (text: string) => setToast(text);
  function update(fn: (d: Data) => Data): Promise<void> {
    const targetDemo = activeDemo.current;
    const task = queue.current.then(async () => {
      const next = targetDemo ? fn(sampleRef.current) : await mutateData(fn);
      if (targetDemo) {
        sampleRef.current = next;
        setSample(next);
      } else {
        realRef.current = next;
        setData(next);
      }
      if (activeDemo.current === targetDemo) ref.current = next;
    });
    queue.current = task.catch(() => {});
    task.catch((e) =>
      notify(
        e instanceof Error
          ? e.message
          : "Could not save changes. Check browser storage and retry.",
      ),
    );
    return task;
  }
  const completeOnboarding = () =>
    void update((d) => ({ ...d, profile: { ...d.profile, onboarded: true } }));
  function go(next: string) {
    setGameId(null);
    setResult(null);
    location.hash = next;
    setPage(next);
    window.scrollTo({ top: 0 });
  }
  useEffect(() => {
    const hash = () => {
      setPage(location.hash.slice(1) || "home");
      setGameId(null);
      setResult(null);
    };
    window.addEventListener("hashchange", hash);
    return () => window.removeEventListener("hashchange", hash);
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    const dark = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      root.dataset.theme =
        current.profile.theme === "system"
          ? dark.matches
            ? "dark"
            : "light"
          : current.profile.theme;
      root.dataset.motion = current.profile.reducedMotion
        ? "reduced"
        : "normal";
    };
    apply();
    dark.addEventListener("change", apply);
    return () => dark.removeEventListener("change", apply);
  }, [current.profile.theme, current.profile.reducedMotion]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 6000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "k" &&
        !(
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          e.target instanceof HTMLSelectElement
        )
      ) {
        e.preventDefault();
        setPalette((p) => !p);
        setQuery("");
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    if (!current.profile.reminder) return;
    const timer = setTimeout(
      () => {
        if ("Notification" in window && Notification.permission === "granted")
          new Notification("A little room for your mind", {
            body: "Your Brain Gym workout is ready when you are.",
          });
      },
      60 * 60 * 1000,
    );
    return () => clearTimeout(timer);
  }, [current.profile.reminder]);
  function play(id: string, isWorkout = false) {
    if (
      gameId &&
      !result &&
      !window.confirm(
        "Leave this exercise? The unfinished exercise will not be saved.",
      )
    )
      return;
    setGameStarted(false);
    setDifficulty(
      isWorkout
        ? dailyWorkout(ref.current).difficulty
        : ref.current.profile.difficulty,
    );
    setGameId(id);
    setWorkout(isWorkout);
    setResult(null);
    setReward("");
    window.scrollTo({ top: 0 });
    if (isWorkout) {
      const w = dailyWorkout(ref.current);
      if (!ref.current.workouts.some((x) => x.id === w.id))
        void update((d) =>
          d.workouts.some((x) => x.id === w.id)
            ? d
            : { ...d, workouts: [...d.workouts, w] },
        ).catch(() => {});
      workoutId.current = w.id;
    }
  }
  async function finish(s: Session) {
    const previous = ref.current;
    const w = workout
      ? previous.workouts.find((w) => w.id === workoutId.current)
      : null;
    if (workout && !w)
      throw new Error(
        "Workout could not be loaded. Return to the workout page.",
      );
    const full = { ...s, ...(w ? { workoutId: w.id } : {}) };
    const targetDemo = activeDemo.current;
    let beforeData = previous,
      resulting = previous;
    await update((d) => {
      beforeData = d;
      resulting = recordSession(d, full);
      return resulting;
    });
    if (targetDemo !== activeDemo.current) return;
    const recorded = resulting.sessions.find((x) => x.id === full.id);
    if (!recorded) {
      const savedWorkout = resulting.workouts.find((x) => x.id === w?.id);
      const prior = savedWorkout?.sessionIds
        .map((id) => resulting.sessions.find((x) => x.id === id))
        .find((x) => x?.gameId === s.gameId);
      if (prior) {
        setReward("Already recorded in another tab · no duplicate XP");
        setResult(prior);
        return;
      }
      throw new Error(
        "This workout step changed in another tab. Return to the workout page.",
      );
    }
    const oldBest = best(beforeData.sessions, s.gameId),
      gained = xp(resulting) - xp(beforeData),
      newAchievements = achievements(resulting).filter(
        (a) =>
          a.unlocked &&
          !achievements(beforeData).find((b) => b.id === a.id)?.unlocked,
      );
    setReward(
      `+${gained} XP${!oldBest || best(resulting.sessions, s.gameId)?.id === s.id ? " · Personal best" : ""}${newAchievements.length ? " · " + newAchievements.map((a) => a.name).join(", ") : ""}`,
    );
    setResult(recorded);
  }
  function setDemo(value: boolean) {
    activeDemo.current = value;
    ref.current = value ? sampleRef.current : realRef.current;
    setDemoState(value);
    setGameId(null);
    setResult(null);
    go("home");
  }
  async function recoveryDownload() {
    const row = await db.state.get("main");
    download(
      `brain-gym-recovery-${localDay()}.json`,
      JSON.stringify(
        {
          version: 1,
          exportedAt: new Date().toISOString(),
          data: row?.data ?? null,
        },
        null,
        2,
      ),
    );
  }
  async function recoveryRestore(file?: File) {
    if (!file) return;
    try {
      if (file.size > 20_000_000)
        throw new Error("Backup exceeds the 20 MB limit.");
      const restored = validateBackup(JSON.parse(await file.text()));
      if (
        !window.confirm(
          "Replace unreadable saved data with this validated backup? A raw recovery download will be created first.",
        )
      )
        return;
      await recoveryDownload();
      await saveData(restored);
      location.reload();
    } catch (e) {
      setFatal(
        e instanceof Error
          ? e.message
          : "Recovery could not complete. Your saved data has not been reset.",
      );
    }
  }
  if (fatal)
    return (
      <main className="empty">
        <h1>Storage needs attention</h1>
        <p role="alert">{fatal}</p>
        <p>
          Your stored data has not been reset. You can download the raw data for
          recovery or restore a validated backup. If storage is blocked, first
          enable site storage in your browser.
        </p>
        <div className="modal-actions">
          <button onClick={() => location.reload()}>Retry</button>
          <button
            onClick={() =>
              void recoveryDownload().catch(() =>
                setFatal(
                  "Browser storage could not be read. Enable site storage and retry.",
                ),
              )
            }
          >
            Download raw recovery
          </button>
          <label className="file-button">
            Restore validated backup
            <input
              aria-label="Restore validated backup"
              type="file"
              accept=".json,application/json"
              onChange={(e) => void recoveryRestore(e.target.files?.[0])}
            />
          </label>
        </div>
      </main>
    );
  if (!ready) return <main className="empty">Opening your space…</main>;
  const l = level(xp(current));
  const commands = [
    ...nav.map(([id, name]) => ({
      name: `Open ${name}`,
      action: () => go(id),
    })),
    ...games.map((g) => ({ name: `Play ${g.name}`, action: () => play(g.id) })),
    { name: "Start Daily Workout", action: () => go("workout") },
    {
      name: "Toggle Theme",
      action: () =>
        void update((d) => ({
          ...d,
          profile: {
            ...d.profile,
            theme: d.profile.theme === "dark" ? "light" : "dark",
          },
        })),
    },
  ].filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));
  return (
    <Context.Provider
      value={{
        data: current,
        update: (fn) =>
          update(fn).then(
            () => true,
            () => false,
          ),
        go,
        play,
        demo,
        setDemo,
        notify,
        openResult: (s) => {
          setGameId(null);
          setReward("");
          setResult(s);
        },
      }}
    >
      <div className="app-shell">
        <a
          className="skip"
          href="#main"
          onClick={(e) => {
            e.preventDefault();
            document.getElementById("main")?.focus();
          }}
        >
          Skip to content
        </a>
        <aside className="sidebar">
          <button className="brand" onClick={() => go("home")}>
            <span>
              <Brain size={23} />
            </span>
            brain gym<span className="brand-dot">.</span>
          </button>
          <div className="sidebar-label">YOUR DAILY PRACTICE</div>
          <nav aria-label="Main navigation">
            {nav.map(([id, name, Icon]) => (
              <a
                href={`#${id}`}
                onClick={(e) => {
                  e.preventDefault();
                  go(id);
                }}
                key={id}
                className={page === id ? "active" : ""}
                aria-current={page === id ? "page" : undefined}
              >
                <Icon size={19} />
                <span>{name}</span>
                {id === "workout" && <small aria-hidden="true">5</small>}
              </a>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="sidebar-note">
              <span>✳</span>
              <strong>
                Small steps.
                <br />
                Stronger habits.
              </strong>
              <p>A little room for your mind, every day.</p>
            </div>
            <button className="profile-button" onClick={() => go("settings")}>
              <span className="avatar">
                {current.profile.name.slice(0, 2).toUpperCase() || "YOU"}
              </span>
              <span>
                <strong>{current.profile.name || "Your space"}</strong>
                <small>
                  Level {l.value} · {xp(current)} XP
                </small>
              </span>
              <SettingsIcon size={16} />
            </button>
          </div>
        </aside>
        <div className="main-shell">
          <div className="topbar">
            <div className="breadcrumb">
              Your space <ChevronRight size={13} />{" "}
              <strong>
                {gameId
                  ? getGame(gameId).name
                  : nav.find((n) => n[0] === page)?.[1] || "Home"}
              </strong>
            </div>
            <button
              className="search-button"
              onClick={() => {
                setPalette(true);
                setQuery("");
              }}
            >
              <Search size={15} />
              <span>Find your focus</span>
              <kbd>⌘ K</kbd>
            </button>
            <span className="private-dot">
              ● <span>Local & private</span>
            </span>
          </div>
          {demo && (
            <div className="demo-banner">
              SAMPLE WORKSPACE · Demo data is separate from your progress.
              <button onClick={() => setDemo(false)}>Exit demo →</button>
            </div>
          )}
          <main id="main" tabIndex={-1}>
            {gameId ? (
              <>
                <button
                  className="back"
                  onClick={() => {
                    if (
                      result ||
                      window.confirm(
                        "Leave without saving this unfinished exercise?",
                      )
                    ) {
                      go(workout ? "workout" : "train");
                    }
                  }}
                >
                  <ArrowLeft size={16} /> Back to{" "}
                  {workout ? "workout" : "training"}
                </button>
                <div className="game-heading">
                  <span className="eyebrow">
                    {getGame(gameId).category} TRAINING
                  </span>
                  <h1>{getGame(gameId).name}</h1>
                </div>
                <section className="panel game-panel">
                  {result ? (
                    <>
                      <Result session={result} />
                      <p className="xp-reward" role="status">
                        {reward}
                      </p>
                      <div className="modal-actions">
                        <button
                          onClick={() => {
                            setResult(null);
                            setGameId(null);
                            setTimeout(() => play(gameId), 0);
                          }}
                        >
                          Play again
                        </button>
                        <button
                          className="primary"
                          onClick={() => go(workout ? "workout" : "history")}
                        >
                          {workout ? "Continue workout" : "View history"} →
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <label className="difficulty-select">
                        Difficulty
                        <select
                          disabled={workout || gameStarted}
                          value={difficulty}
                          onChange={(e) =>
                            setDifficulty(e.target.value as Difficulty)
                          }
                        >
                          {["Easy", "Normal", "Hard"].map((d) => (
                            <option key={d}>{d}</option>
                          ))}
                        </select>
                      </label>
                      <Play
                        key={`${gameId}-${difficulty}`}
                        game={getGame(gameId)}
                        difficulty={difficulty}
                        onStarted={() => setGameStarted(true)}
                        onFinish={finish}
                        sound={current.profile.sound}
                        volume={current.profile.volume}
                        keyboardHints={current.profile.keyboardHints}
                      />
                    </>
                  )}
                </section>
              </>
            ) : page === "train" ? (
              <Train />
            ) : page === "workout" ? (
              <WorkoutPage />
            ) : page === "challenges" ? (
              <Challenges />
            ) : page === "progress" ? (
              <Suspense fallback={<p>Loading your progress…</p>}>
                <Progress />
              </Suspense>
            ) : page === "achievements" ? (
              <Achievements />
            ) : page === "history" ? (
              <History />
            ) : page === "settings" ? (
              <Settings />
            ) : (
              <Dashboard />
            )}
            <footer>
              <span>Brain Gym · A little better at what you practice.</span>
              <span>No accounts. No pressure. Just practice.</span>
            </footer>
          </main>
        </div>
      </div>
      {result && !gameId && (
        <Modal
          title={getGame(result.gameId).name}
          onClose={() => setResult(null)}
        >
          <Result session={result} />
          <button className="primary" onClick={() => play(result.gameId)}>
            Play again →
          </button>
        </Modal>
      )}
      {palette && (
        <Modal
          title="What would you like to practice?"
          onClose={() => setPalette(false)}
        >
          <input
            autoFocus
            aria-label="Search commands"
            placeholder="Search games and destinations…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="commands">
            {commands.map((c) => (
              <button
                key={c.name}
                onClick={() => {
                  setPalette(false);
                  c.action();
                }}
              >
                {c.name}
                <span>↵</span>
              </button>
            ))}
            {!commands.length && <p>No matching commands.</p>}
          </div>
        </Modal>
      )}
      {!current.profile.onboarded && (
        <Modal
          title="Make a little room for your mind."
          onClose={completeOnboarding}
        >
          <p>
            Welcome to Brain Gym. Short exercises. Your own pace. All progress
            stays on this device.
          </p>
          <label>
            What should we call you?
            <input
              maxLength={80}
              value={current.profile.name}
              onChange={(e) => {
                const name = e.target.value;
                void update((d) => ({ ...d, profile: { ...d.profile, name } }));
              }}
            />
          </label>
          <label>
            Start with
            <select
              value={current.profile.difficulty}
              onChange={(e) => {
                const difficulty = e.target.value as Difficulty;
                void update((d) => ({
                  ...d,
                  profile: { ...d.profile, difficulty },
                }));
              }}
            >
              {["Easy", "Normal", "Hard"].map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          <label>
            Time for practice
            <select
              value={current.profile.duration}
              onChange={(e) => {
                const duration = +e.target.value;
                void update((d) => ({
                  ...d,
                  profile: { ...d.profile, duration },
                }));
              }}
            >
              {[3, 5, 10, 15].map((v) => (
                <option key={v} value={v}>
                  {v} minutes
                </option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend>What interests you?</legend>
            <div className="chips">
              {categories.map((c) => (
                <button
                  key={c}
                  aria-pressed={current.profile.categories.includes(c)}
                  onClick={() =>
                    void update((d) => ({
                      ...d,
                      profile: {
                        ...d.profile,
                        categories: d.profile.categories.includes(c)
                          ? d.profile.categories.filter((x) => x !== c)
                          : [...d.profile.categories, c],
                      },
                    }))
                  }
                >
                  {c}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="modal-actions">
            <button onClick={completeOnboarding}>Skip for now</button>
            <button className="primary" onClick={completeOnboarding}>
              Find my focus →
            </button>
          </div>
        </Modal>
      )}
      {toast && (
        <div role="status" className="toast">
          {toast}
          <button aria-label="Dismiss message" onClick={() => setToast("")}>
            ×
          </button>
        </div>
      )}
    </Context.Provider>
  );
}
