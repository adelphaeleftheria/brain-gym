import { useEffect, useRef, useId } from "react";
import { X, ArrowUpRight } from "lucide-react";
import { games, getGame } from "../games/registry";
import { useStore } from "../app/context";
import type { Session } from "../domain/model";
export function Empty({
  title = "Your progress starts here",
  text = "Complete an exercise to see your own results.",
  action = true,
}: {
  title?: string;
  text?: string;
  action?: boolean;
}) {
  const { go } = useStore();
  return (
    <div className="empty">
      <span className="empty-icon">↗</span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action && (
        <button onClick={() => go("train")}>
          Find an exercise <ArrowUpRight size={16} />
        </button>
      )}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    headingId = useId();
  useEffect(() => {
    const prev = document.activeElement as HTMLElement;
    const el = ref.current!;
    el.showModal();
    return () => {
      el.close();
      prev?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={headingId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="dialog-heading">
        <h2 id={headingId}>{title}</h2>
        <button aria-label="Close dialog" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function GameCards({ limit = games.length }: { limit?: number }) {
  const { play } = useStore();
  return (
    <div className="game-cards">
      {games.slice(0, limit).map((g, i) => (
        <button className="game-card" onClick={() => play(g.id)} key={g.id}>
          <div className="card-top">
            <span className={`mini-symbol tone-${i % 3}`}>{g.symbol}</span>
            <ArrowUpRight size={18} />
          </div>
          <span className="eyebrow">
            {g.category} · {g.minutes} MIN
          </span>
          <h3>{g.name}</h3>
          <p>{g.description}</p>
          <span className="game-card-footer">
            Start training <span>→</span>
          </span>
        </button>
      ))}
    </div>
  );
}
export function SessionRows({ sessions }: { sessions: Session[] }) {
  const { openResult } = useStore();
  return (
    <div className="session-list">
      {sessions.map((s) => (
        <button
          key={s.id}
          className="session-row"
          onClick={() => openResult(s)}
        >
          <span className="mini-symbol">{getGame(s.gameId).symbol}</span>
          <span className="session-name">
            <strong>{getGame(s.gameId).name}</strong>
            <small>
              {new Date(s.end).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}{" "}
              · {s.category} · {s.difficulty} · {Math.round(s.duration / 1000)}s
              · Completed
            </small>
          </span>
          <span>
            <strong>
              {s.score}
              <small> /100</small>
            </strong>
            <small>{Math.round(s.accuracy)}% accuracy</small>
          </span>
          <ArrowUpRight size={16} />
        </button>
      ))}
    </div>
  );
}
export function Result({ session: s }: { session: Session }) {
  return (
    <>
      <div className="result-score">
        <span className="eyebrow">EXERCISE COMPLETE</span>
        <strong>
          {s.score}
          <small>/100</small>
        </strong>
        <p>Practice logged. A little progress, every day.</p>
      </div>
      <div className="stats-grid">
        <div>
          <small>Accuracy</small>
          <strong>{Math.round(s.accuracy)}%</strong>
        </div>
        <div>
          <small>Duration</small>
          <strong>{Math.round(s.duration / 1000)}s</strong>
        </div>
        <div>
          <small>Correct</small>
          <strong>
            {s.correct}/{s.attempts}
          </strong>
        </div>
      </div>
      {Object.keys(s.metrics).length > 0 && (
        <dl className="metrics">
          {Object.entries(s.metrics)
            .filter(([k]) => k !== "scoringVersion")
            .map(([k, v]) => (
              <div key={k}>
                <dt>{k.replace(/([A-Z])/g, " $1")}</dt>
                <dd>{Number.isInteger(v) ? v : v.toFixed(1)}</dd>
              </div>
            ))}
        </dl>
      )}
      <p className="muted">
        {s.scoringVersion !== 2 && "Legacy scoring · "}Scores describe
        performance in this exercise. They do not measure IQ or overall
        cognitive ability.
      </p>
    </>
  );
}
