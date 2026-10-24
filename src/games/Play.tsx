import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Difficulty, Game, Session } from "../domain/model";
import {
  accuracy,
  localDay,
  mathQuestion,
  logicQuestion,
  patternQuestion,
  rank,
  gameScore,
  numericAnswer,
  shuffle,
  type Question,
} from "../domain/engine";
interface Props {
  game: Game;
  difficulty: Difficulty;
  onFinish: (s: Session) => Promise<void>;
  sound: boolean;
  volume: number;
  onStarted?: () => void;
  keyboardHints?: boolean;
}
const WORDS = [
  "constellation",
  "perspective",
  "architecture",
  "equilibrium",
  "imagination",
  "garden",
  "planet",
  "window",
  "silver",
  "bridge",
  "forest",
  "puzzle",
  "candle",
  "orange",
  "pocket",
  "winter",
  "stream",
  "velvet",
  "anchor",
  "bright",
  "marble",
];
export function rotate(shape: number[], turns: number) {
  let a = [...shape];
  for (let t = 0; t < turns; t++)
    a = Array.from(
      { length: 9 },
      (_, i) => a[(2 - (i % 3)) * 3 + Math.floor(i / 3)],
    );
  return a;
}
export default function Play({
  game,
  difficulty,
  onFinish,
  sound,
  volume,
  onStarted,
  keyboardHints = true,
}: Props) {
  const [phase, setPhase] = useState<"intro" | "play" | "saving" | "error">(
    "intro",
  );
  const [round, setRound] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [question, setQuestion] = useState<Question>();
  const [input, setInput] = useState("");
  const [locked, setLocked] = useState(false);
  const [lit, setLit] = useState(-1);
  const [sequence, setSequence] = useState<number[]>([]);
  const [cursor, setCursor] = useState(0);
  const [grid, setGrid] = useState<string[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [reaction, setReaction] = useState<"ready" | "wait" | "go">("ready");
  const [times, setTimes] = useState<number[]>([]);
  const [falseStarts, setFalseStarts] = useState(0);
  const [number, setNumber] = useState("");
  const [showNumber, setShowNumber] = useState(false);
  const [shapes, setShapes] = useState<number[][]>([]);
  const [shape, setShape] = useState<number[]>([]);
  const [hint, setHint] = useState(false);
  const [remaining, setRemaining] = useState([90, 60, 45][rank(difficulty)]);
  const [interrupted, setInterrupted] = useState(false);
  const clock = useRef(0),
    signal = useRef(0),
    roundClock = useRef(0),
    started = useRef(""),
    busy = useRef(false),
    done = useRef(false),
    id = useRef(crypto.randomUUID()),
    timers = useRef<ReturnType<typeof setTimeout>[]>([]),
    saved = useRef<Session | null>(null);
  const responses = useRef<number[]>([]),
    run = useRef(0),
    longest = useRef(0),
    misses = useRef(0),
    alarms = useRef(0),
    hintsUsed = useRef(0);
  function track(ok: boolean) {
    const now = performance.now();
    responses.current.push(Math.max(0, now - roundClock.current));
    roundClock.current = now;
    run.current = ok ? run.current + 1 : 0;
    longest.current = Math.max(longest.current, run.current);
  }
  const inputRef = useRef<HTMLInputElement>(null),
    lettersRef = useRef<string[]>([]),
    frame = useRef<number | undefined>(undefined);
  const n = rank(difficulty),
    size = n === 2 ? 4 : 3;
  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };
  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (frame.current !== undefined) cancelAnimationFrame(frame.current);
  };
  useEffect(() => () => clear(), []);
  useEffect(() => {
    const visibility = () => {
      if (document.hidden && phase === "play") {
        clear();
        setInterrupted(true);
        busy.current = true;
      }
    };
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, [phase]);
  function beep(ok: boolean) {
    if (!sound) return;
    try {
      const ctx = new AudioContext(),
        osc = ctx.createOscillator(),
        gain = ctx.createGain();
      gain.gain.value = volume * 0.1;
      osc.frequency.value = ok ? 660 : 220;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
      osc.onended = () => void ctx.close();
    } catch {
      /* Sound is optional. */
    }
  }
  async function finish(
    c = correct,
    a = attempts,
    metrics: Record<string, number> = {},
  ) {
    if (done.current) return;
    done.current = true;
    clear();
    const duration = Math.max(1, performance.now() - clock.current);
    const normalized = gameScore(game.id, difficulty, c, a, duration / 1000, {
      ...metrics,
      ...(game.id === "words" ? { hintsUsed: hintsUsed.current } : {}),
    });
    const s: Session = {
      id: id.current,
      gameId: game.id,
      category: game.category,
      difficulty,
      start: started.current,
      end: new Date().toISOString(),
      dateKey: localDay(),
      duration,
      rawScore: c,
      score: normalized,
      accuracy: accuracy(c, a),
      attempts: a,
      correct: c,
      status: "completed",
      scoringVersion: 2,
      metrics: {
        ...(game.id === "reaction"
          ? { averageResponseMs: metrics.averageMs }
          : responses.current.length
            ? {
                averageResponseMs: responses.current.length
                  ? responses.current.reduce((a, b) => a + b, 0) /
                    responses.current.length
                  : 0,
              }
            : {}),
        ...(game.id === "words" ? { hintsUsed: hintsUsed.current } : {}),
        correctPerMinute: c / (duration / 60000),
        ...(game.id === "reaction"
          ? {}
          : { longestCorrectStreak: longest.current }),
        ...(game.id === "nback"
          ? { missedMatches: misses.current, falseAlarms: alarms.current }
          : {}),
        ...metrics,
      },
    };
    saved.current = s;
    setPhase("saving");
    try {
      await onFinish(s);
    } catch {
      setPhase("error");
    }
  }
  function nextQuestion(index: number) {
    setInput("");
    setLocked(false);
    busy.current = false;
    setFeedback("");
    setHint(false);
    roundClock.current = performance.now();
    if (game.id === "math") setQuestion(mathQuestion(difficulty));
    if (game.id === "logic") setQuestion(logicQuestion(difficulty));
    if (game.id === "sequence") setQuestion(patternQuestion(difficulty));
    if (game.id === "words") {
      setHint(n === 0);
      const word = shuffle(
        WORDS.filter((w) =>
          n === 2
            ? w.length >= 8
            : n === 1
              ? w.length >= 6 && w.length <= 8
              : w.length <= 6,
        ),
      )[0];
      let scramble = shuffle(word.split("")).join("");
      if (scramble === word) scramble = word.slice(1) + word[0];
      setQuestion({
        prompt: scramble,
        answer: word,
        choices: [],
        explanation: `The word is ${word}.`,
        hint: word[0],
      });
    }
    if (game.id === "color") {
      const colors = ["red", "blue", "green", "purple"];
      const ink = shuffle(colors)[0];
      setQuestion({
        prompt:
          n === 0
            ? ink
            : n === 2
              ? shuffle(colors.filter((c) => c !== ink))[0]
              : shuffle(colors)[0],
        answer: ink,
        choices: shuffle(colors),
        explanation: `The ink color is ${ink}.`,
        ink,
      });
    }
    if (game.id === "spatial") {
      const base = [1, 0, 0, 1, 1, 0, 0, 1, 1],
        turns = 1 + Math.floor(Math.random() * (n + 1)),
        source = rotate(base, Math.floor(Math.random() * 4));
      const correctShape = rotate(source, turns);
      const options = shuffle([
        correctShape,
        rotate(correctShape, 1),
        rotate(correctShape, 2),
        rotate(correctShape, 3),
      ]);
      setShape(source);
      setShapes(options);
      setQuestion({
        prompt: `Rotate ${turns * 90}° clockwise`,
        answer: String(
          options.findIndex((s) => s.join("") === correctShape.join("")),
        ),
        choices: options.map((_, i) => String(i)),
        explanation: `Turn the shape ${turns * 90}° clockwise without reflecting it.`,
      });
    }
    if (game.id === "nback") {
      const next = [...lettersRef.current],
        back = n === 2 ? 2 : 1;
      const letter =
        next.length >= back && Math.random() < 0.4
          ? next[next.length - back]
          : shuffle(n === 0 ? ["A", "B"] : ["A", "B", "C", "D"])[0];
      const answer =
        next.length >= back && letter === next[next.length - back]
          ? "Match"
          : "Different";
      next.push(letter);
      lettersRef.current = next;
      setQuestion({
        prompt: letter,
        answer,
        choices: ["Match", "Different"],
        explanation:
          answer === "Match"
            ? `Matches ${back} step${back === 2 ? "s" : ""} back.`
            : `Does not match ${back} step${back === 2 ? "s" : ""} back.`,
      });
    }

    if (game.id === "focus") {
      setSelected([]);
      setGrid(
        shuffle(
          Array.from({ length: [16, 25, 36][n] }, (_, i) =>
            i < [4, 6, 9][n] ? "A" : shuffle(["R", "H", "V", "N"])[0],
          ),
        ),
      );
    }
    if (game.id === "numbers") {
      const digits = Array.from({ length: 3 + n + index }, () =>
        Math.floor(Math.random() * 10),
      ).join("");
      setNumber(digits);
      setShowNumber(true);
      busy.current = true;
      later(() => {
        setShowNumber(false);
        busy.current = false;
        roundClock.current = performance.now();
      }, [2200, 1800, 1400][n]);
    }
  }
  function playback(seq: number[]) {
    setSequence(seq);
    setCursor(0);
    setLocked(true);
    busy.current = true;
    setFeedback("Watch the sequence");
    const speed = [650, 500, 350][n];
    seq.forEach((cell, i) => {
      later(() => setLit(cell), 400 + i * (speed + 180));
      later(() => setLit(-1), 400 + i * (speed + 180) + speed);
    });
    later(
      () => {
        setLocked(false);
        busy.current = false;
        setFeedback("Your turn · repeat the sequence");
        roundClock.current = performance.now();
      },
      400 + seq.length * (speed + 180),
    );
  }
  function start() {
    onStarted?.();
    setRound(0);
    setCorrect(0);
    setAttempts(0);
    setFeedback("");
    setLocked(false);
    setLit(-1);
    setTimes([]);
    setFalseStarts(0);
    setReaction("ready");
    lettersRef.current = [];
    setInterrupted(false);
    responses.current = [];
    run.current = 0;
    longest.current = 0;
    misses.current = 0;
    alarms.current = 0;
    hintsUsed.current = 0;
    id.current = crypto.randomUUID();
    clear();
    done.current = false;
    busy.current = false;
    setPhase("play");
    started.current = new Date().toISOString();
    clock.current = performance.now();
    roundClock.current = clock.current;
    if (game.id === "memory")
      playback(
        Array.from({ length: 2 + n }, () =>
          Math.floor(Math.random() * size * size),
        ),
      );
    else nextQuestion(0);
  }
  useEffect(() => {
    if (phase !== "play" || game.id !== "math" || interrupted) return;
    const limit = [90, 60, 45][n];
    const timer = setInterval(() => {
      const left = Math.max(
        0,
        limit - (performance.now() - clock.current) / 1000,
      );
      setRemaining(Math.ceil(left));
      if (left <= 0) void finish(correct, attempts);
    }, 100);
    return () => clearInterval(timer);
  }, [phase, game.id, correct, attempts, interrupted]);
  function answer(value: string) {
    if (busy.current || done.current || interrupted || !question) return;
    busy.current = true;
    setLocked(true);
    const warmup = game.id === "nback" && round < (n === 2 ? 2 : 1);
    const ok =
      game.id === "math"
        ? numericAnswer(value, question.answer)
        : value.trim().toLowerCase() === question.answer.toLowerCase();
    if (!warmup) track(ok);
    if (game.id === "nback" && !warmup && !ok) {
      if (question.answer === "Match") misses.current++;
      else alarms.current++;
    }
    const c = correct + (ok && !warmup ? 1 : 0),
      a = attempts + (!warmup ? 1 : 0);
    setCorrect(c);
    setAttempts(a);
    beep(ok);
    setFeedback(
      `${warmup ? "Sequence established" : ok ? "Correct" : "Not quite"} · ${question.explanation}`,
    );
    const max =
      game.id === "math"
        ? 10
        : game.id === "color"
          ? 12
          : game.id === "nback"
            ? 16 + (n === 2 ? 2 : 1)
            : 8;
    later(() => {
      if (round + 1 >= max) void finish(c, a);
      else {
        setRound(round + 1);
        nextQuestion(round + 1);
      }
    }, 1100);
  }
  function memoryTap(cell: number) {
    if (busy.current || done.current || interrupted) return;
    const a = attempts + 1;
    track(cell === sequence[cursor]);
    setAttempts(a);
    if (cell !== sequence[cursor]) {
      busy.current = true;
      setFeedback("That tile was out of order.");
      beep(false);
      later(
        () =>
          void finish(correct, a, {
            span: round ? sequence.length - 1 : 0,
            longestRun: round,
          }),
        900,
      );
      return;
    }
    beep(true);
    setCorrect(correct + 1);
    setLit(cell);
    later(() => setLit(-1), 150);
    if (cursor + 1 === sequence.length) {
      busy.current = true;
      setLocked(true);
      if (round === 5)
        later(
          () =>
            void finish(correct + 1, a, {
              span: sequence.length,
              longestRun: 6,
            }),
          500,
        );
      else
        later(() => {
          setRound(round + 1);
          playback([...sequence, Math.floor(Math.random() * size * size)]);
        }, 650);
    } else setCursor(cursor + 1);
  }
  function focusTap(index: number) {
    if (selected.includes(index) || busy.current || interrupted) return;
    const ok = grid[index] === "A",
      sel = [...selected, index],
      c = correct + (ok ? 1 : 0),
      a = attempts + 1;
    track(ok);
    setSelected(sel);
    setCorrect(c);
    setAttempts(a);
    beep(ok);
    setFeedback(ok ? "Target found" : "That is not an A");
    if (sel.filter((i) => grid[i] === "A").length === [4, 6, 9][n]) {
      busy.current = true;
      later(() => {
        if (round === 2) void finish(c, a, { falseSelections: a - c });
        else {
          setRound(round + 1);
          nextQuestion(round + 1);
        }
      }, 650);
    }
  }
  function reactionTap() {
    if (done.current || interrupted || busy.current) return;
    if (reaction === "ready") {
      setReaction("wait");
      setFeedback("Wait for GO…");
      later(
        () => {
          frame.current = requestAnimationFrame(() => {
            setReaction("go");
          });
        },
        [1200, 1500, 1800][n] + Math.random() * [1500, 3000, 4500][n],
      );
    } else if (reaction === "wait") {
      clear();
      setFalseStarts(falseStarts + 1);
      setFeedback("Too soon. No reaction recorded. Try again.");
      setReaction("ready");
      beep(false);
    } else {
      const ms = performance.now() - signal.current;
      if (ms < 80) {
        setFalseStarts(falseStarts + 1);
        setFeedback("Anticipated signal. Try again.");
        setReaction("ready");
        return;
      }
      const result = [...times, ms];
      setTimes(result);
      setCorrect(result.length);
      setAttempts(result.length + falseStarts);
      beep(true);
      setFeedback(`${Math.round(ms)} ms`);
      setReaction("ready");
      setRound(result.length);
      if (result.length === 5) {
        busy.current = true;
        const averageMs = result.reduce((s, t) => s + t, 0) / 5;
        later(() => {
          void finish(5, 5 + falseStarts, {
            averageMs,
            bestMs: Math.min(...result),
            slowestMs: Math.max(...result),
            falseStarts,
            ...Object.fromEntries(result.map((t, i) => [`round${i + 1}Ms`, t])),
          });
        }, 700);
      }
    }
  }
  useLayoutEffect(() => {
    if (reaction === "go") signal.current = performance.now();
  }, [reaction]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        phase !== "play" ||
        interrupted ||
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLSelectElement ||
        e.target instanceof HTMLTextAreaElement ||
        !!document.querySelector("dialog[open]") ||
        (e.target instanceof HTMLElement &&
          !!e.target.closest("button,a") &&
          !e.target.closest(".reaction,.memory"))
      )
        return;
      if (game.id === "reaction" && e.code === "Space") {
        e.preventDefault();
        if (!e.repeat) reactionTap();
      }
      if (game.id === "memory" && /^[1-9]$/.test(e.key))
        memoryTap(Number(e.key) - 1);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  useEffect(() => {
    if (phase === "play" && !locked && !showNumber && !interrupted)
      inputRef.current?.focus();
  }, [question, phase, locked, showNumber, interrupted]);
  if (phase === "intro")
    return (
      <div className="game-intro">
        <span className="game-symbol">{game.symbol}</span>
        <h2>{game.name}</h2>
        <p>{game.instructions}</p>
        <div className="pill">
          {difficulty} · About {game.minutes} min
        </div>
        <button className="primary" onClick={start}>
          Start exercise →
        </button>
      </div>
    );
  if (phase === "saving")
    return <div className="empty">Saving your result…</div>;
  if (phase === "error")
    return (
      <div role="alert" className="empty">
        <h2>Your result is still here.</h2>
        <p>Storage could not save. Free browser space and retry.</p>
        <button
          onClick={() => {
            if (saved.current) {
              setPhase("saving");
              void onFinish(saved.current).catch(() => setPhase("error"));
            }
          }}
        >
          Retry saving
        </button>
      </div>
    );
  return (
    <div className="play">
      <div className="game-meta">
        <span>{difficulty}</span>
        <span>
          {game.id === "reaction"
            ? `${times.length}/5 rounds`
            : game.id === "memory"
              ? `Round ${round + 1}/6`
              : game.id === "focus"
                ? `Grid ${round + 1}/3`
                : `Question ${round + 1}`}{" "}
          {game.id === "math" && `· ${remaining}s`}
        </span>
      </div>
      {interrupted ? (
        <div className="empty">
          <h2>Session interrupted</h2>
          <p>
            We paused because the tab was hidden. Restart this exercise for
            reliable timing; no result or XP was recorded.
          </p>
          <button onClick={start}>Restart exercise</button>
        </div>
      ) : (
        <>
          {game.id === "memory" && (
            <>
              <h2>{locked ? "Watch closely" : "Repeat the pattern"}</h2>
              <div
                className="tile-grid memory"
                style={{ gridTemplateColumns: `repeat(${size},1fr)` }}
              >
                {Array.from({ length: size * size }, (_, i) => (
                  <button
                    key={i}
                    aria-label={`Tile ${i + 1}${lit === i ? ", illuminated" : ""}`}
                    disabled={locked}
                    className={lit === i ? "lit" : ""}
                    onClick={() => memoryTap(i)}
                  >
                    {keyboardHints ? i + 1 : ""}
                  </button>
                ))}
              </div>
            </>
          )}
          {game.id === "focus" && (
            <>
              <h2>
                Find every <em>A</em>
              </h2>
              <p>
                {selected.filter((i) => grid[i] === "A").length} of{" "}
                {[4, 6, 9][n]} targets found
              </p>
              <div
                className={`tile-grid focus grid-${[4, 5, 6][n]}`}
                style={{ gridTemplateColumns: `repeat(${[4, 5, 6][n]},1fr)` }}
              >
                {grid.map((v, i) => (
                  <button
                    key={i}
                    aria-label={`Row ${Math.floor(i / [4, 5, 6][n]) + 1}, tile ${i + 1}: ${v}`}
                    disabled={selected.includes(i)}
                    className={
                      selected.includes(i)
                        ? v === "A"
                          ? "found"
                          : "wrong"
                        : ""
                    }
                    onClick={() => focusTap(i)}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </>
          )}
          {game.id === "reaction" && (
            <button className={`reaction ${reaction}`} onClick={reactionTap}>
              <strong>
                {reaction === "ready"
                  ? "Ready?"
                  : reaction === "wait"
                    ? "Wait…"
                    : "GO!"}
              </strong>
              <span>
                {reaction === "ready"
                  ? "Tap to begin the next round"
                  : reaction === "wait"
                    ? "Hold steady"
                    : keyboardHints
                      ? "Tap now · or press Space"
                      : "Tap now"}
              </span>
            </button>
          )}
          {game.id === "numbers" && (
            <>
              <h2>
                {showNumber ? "Hold this number" : "What was the number?"}
              </h2>
              {showNumber ? (
                <div className="question">{number}</div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (busy.current || !input.trim()) return;
                    busy.current = true;
                    const ok = input.trim() === number,
                      c = correct + (ok ? 1 : 0),
                      a = attempts + 1;
                    track(ok);
                    setCorrect(c);
                    setAttempts(a);
                    setFeedback(ok ? "Correct" : `The number was ${number}`);
                    beep(ok);
                    later(() => {
                      if (!ok || round === 4)
                        void finish(c, a, {
                          digits: ok
                            ? number.length
                            : correct > 0
                              ? number.length - 1
                              : 0,
                        });
                      else {
                        setRound(round + 1);
                        nextQuestion(round + 1);
                      }
                    }, 900);
                  }}
                >
                  <input
                    ref={inputRef}
                    autoFocus
                    aria-label="Remembered number"
                    inputMode="numeric"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                  />
                  <button className="primary">Check answer</button>
                </form>
              )}
            </>
          )}
          {question &&
            !["memory", "focus", "reaction", "numbers"].includes(game.id) && (
              <>
                <p className="eyebrow">
                  {game.id === "color"
                    ? "CHOOSE THE INK COLOR"
                    : game.id === "nback"
                      ? `${n === 2 ? 2 : 1}-BACK · ${round < (n === 2 ? 2 : 1) ? "Remember this letter" : "Compare from memory"}`
                      : game.id === "words"
                        ? "UNSCRAMBLE THE WORD"
                        : "FIND THE ANSWER"}
                </p>
                {game.id === "spatial" && <Shape cells={shape} />}
                <div
                  className={`question ${game.id === "color" ? "ink-" + question.ink : ""}`}
                  aria-label={
                    game.id === "color"
                      ? `Word ${question.prompt}, ink color ${question.ink}`
                      : undefined
                  }
                >
                  {question.prompt}
                </div>
                {question.choices.length ? (
                  <div className="answers">
                    {question.choices.map((v, i) => (
                      <button
                        disabled={locked}
                        key={v}
                        onClick={() => answer(v)}
                        aria-label={
                          game.id === "spatial" ? `Option ${i + 1}` : v
                        }
                      >
                        {game.id === "spatial" ? (
                          <Shape cells={shapes[i]} />
                        ) : (
                          v
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (input.trim()) answer(input);
                    }}
                  >
                    <input
                      ref={inputRef}
                      autoFocus
                      aria-label="Your answer"
                      autoComplete="off"
                      inputMode={game.id === "math" ? "decimal" : "text"}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      disabled={locked}
                    />
                    {game.id === "math" && (
                      <button
                        type="button"
                        className="answer-sign"
                        aria-label="Toggle answer sign"
                        disabled={locked}
                        onClick={() => {
                          setInput((value) =>
                            value.startsWith("-")
                              ? value.slice(1)
                              : "-" + value,
                          );
                          inputRef.current?.focus();
                        }}
                      >
                        ±
                      </button>
                    )}
                    <button
                      className="primary"
                      disabled={locked || !input.trim()}
                    >
                      Check answer ↵
                    </button>
                  </form>
                )}
                {game.id === "words" && (
                  <div className="inline">
                    <button
                      disabled={locked || hint}
                      onClick={() => {
                        setHint(true);
                        hintsUsed.current++;
                      }}
                    >
                      Hint {hint && `· starts with ${question.hint}`}
                    </button>
                    <button disabled={locked} onClick={() => answer("")}>
                      Skip word
                    </button>
                  </div>
                )}
              </>
            )}
          <p className="feedback" role="status" aria-live="polite">
            {feedback || "Take your time. Accuracy comes first."}
          </p>
        </>
      )}
    </div>
  );
}
function Shape({ cells }: { cells: number[] }) {
  return (
    <span className="shape" aria-hidden="true">
      {cells.map((v, i) => (
        <i key={i} className={v ? "filled" : ""} />
      ))}
    </span>
  );
}
