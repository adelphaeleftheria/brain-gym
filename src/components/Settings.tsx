import { useState } from "react";
import { useStore } from "../app/context";
import { categories, defaults, type Profile } from "../domain/model";
import { backup, csv, mergeData, validateBackup } from "../storage/db";
import { PageTitle } from "./Pages";
import { Modal } from "./Common";
export default function Settings() {
  const { data, update, notify, demo, setDemo } = useStore();
  const [confirm, setConfirm] = useState<"history" | "reset" | null>(null),
    [incoming, setIncoming] = useState<ReturnType<typeof defaults> | null>(
      null,
    );
  const [pending, setPending] = useState<Partial<Profile>>({});
  const p = { ...data.profile, ...pending };
  const change = <K extends keyof Profile>(key: K, value: Profile[K]) => {
    setPending((previous) => ({ ...previous, [key]: value }));
    void update((d) => ({
      ...d,
      profile: { ...d.profile, [key]: value },
    })).then(() =>
      setPending((previous) => {
        if (previous[key] !== value) return previous;
        const next = { ...previous };
        delete next[key];
        return next;
      }),
    );
  };
  async function importFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > 20_000_000)
        throw new Error("Backup exceeds the 20 MB import limit.");
      setIncoming(validateBackup(JSON.parse(await file.text())));
    } catch (e) {
      notify(e instanceof Error ? e.message : "Could not read backup.");
    }
  }
  async function setReminder(enabled: boolean) {
    if (!enabled) {
      change("reminder", false);
      return;
    }
    if (!("Notification" in window)) {
      notify("This browser does not support notifications.");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        change("reminder", true);
        notify(
          "In-session reminder enabled. It requires this app to remain open.",
        );
      } else notify("Notifications were not enabled.");
    } catch {
      notify("This browser could not enable notifications.");
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="MAKE YOURSELF AT HOME"
        title="Your space. Your pace."
        text="Preferences and progress stay on this device. No account required."
      />
      <div className="settings-grid">
        <section className="panel">
          <h2>Profile & training</h2>
          <label>
            Display name
            <input
              maxLength={80}
              value={p.name}
              onChange={(e) => change("name", e.target.value)}
            />
          </label>
          <label>
            Preferred difficulty
            <select
              value={p.difficulty}
              onChange={(e) =>
                change("difficulty", e.target.value as Profile["difficulty"])
              }
            >
              {["Easy", "Normal", "Hard"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            Time for practice
            <select
              value={p.duration}
              onChange={(e) => change("duration", +e.target.value)}
            >
              {[3, 5, 10, 15].map((v) => (
                <option value={v} key={v}>
                  {v} minutes
                </option>
              ))}
            </select>
          </label>
          <p className="muted">
            Your time preference is saved to your profile. The complete Daily
            Mix remains five exercises (5–10 minutes).
          </p>
          <fieldset>
            <legend>Favorite categories</legend>
            <div className="chips">
              {categories.map((c) => (
                <button
                  key={c}
                  aria-pressed={p.categories.includes(c)}
                  onClick={() =>
                    change(
                      "categories",
                      p.categories.includes(c)
                        ? p.categories.filter((v) => v !== c)
                        : [...p.categories, c],
                    )
                  }
                >
                  {c}
                </button>
              ))}
            </div>
          </fieldset>
        </section>
        <section className="panel">
          <h2>Appearance & accessibility</h2>
          <label>
            Theme
            <select
              aria-label="Theme"
              value={p.theme}
              onChange={(e) =>
                change("theme", e.target.value as Profile["theme"])
              }
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="system">System</option>
            </select>
          </label>
          <label className="toggle">
            <span>Reduce animation</span>
            <input
              type="checkbox"
              checked={p.reducedMotion}
              onChange={(e) => change("reducedMotion", e.target.checked)}
            />
          </label>
          <label className="toggle">
            <span>Keyboard hints</span>
            <input
              type="checkbox"
              checked={p.keyboardHints}
              onChange={(e) => change("keyboardHints", e.target.checked)}
            />
          </label>
          <label className="toggle">
            <span>Sound effects</span>
            <input
              type="checkbox"
              checked={p.sound}
              onChange={(e) => change("sound", e.target.checked)}
            />
          </label>
          <label>
            Sound volume
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={p.volume}
              onChange={(e) => change("volume", +e.target.value)}
            />
          </label>
          {p.keyboardHints && (
            <p className="muted">
              Keyboard: Tab to navigate, Enter to answer. Memory tiles use 1–9;
              reaction uses Space. Hard memory uses a 4×4 grid with standard
              button navigation.
            </p>
          )}
          <label className="toggle">
            <span>Reminders while app is open</span>
            <input
              type="checkbox"
              checked={p.reminder}
              onChange={(e) => void setReminder(e.target.checked)}
            />
          </label>
          <button onClick={() => void setReminder(true)}>
            Enable optional reminder
          </button>
          <p className="muted">
            Browser notifications require permission. Scheduled reminders while
            the app is closed are not supported.
          </p>
        </section>
        <section className="panel">
          <h2>Your data, in your hands</h2>
          <p>
            Stored in IndexedDB on this browser. Clearing browser data can erase
            progress. Nothing syncs between devices. Make a backup regularly.
          </p>
          <div className="data-actions">
            <button onClick={() => backup(data)}>Export full backup ↓</button>
            <button onClick={() => csv(data)}>Export session CSV ↓</button>
            <label className="file-button">
              Import backup ↑
              <input
                type="file"
                accept=".json,application/json"
                onChange={(e) => {
                  void importFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
            <button className="danger" onClick={() => setConfirm("history")}>
              Clear history
            </button>
            <button className="danger" onClick={() => setConfirm("reset")}>
              Reset application
            </button>
          </div>
        </section>
        <section className="panel">
          <h2>A private place to practice</h2>
          <p>Brain Gym 1.0.0</p>
          <p>
            No accounts, ads, paid services, or third-party analytics. Scores
            reflect your performance within each exercise. They do not diagnose
            conditions or guarantee changes in everyday cognition.
          </p>
          <button onClick={() => setDemo(!demo)}>
            {demo ? "Exit demo workspace" : "Explore sample workspace"}
          </button>
          <p className="muted">
            Sample sessions are clearly labeled and kept separate from your real
            history.
          </p>
        </section>
      </div>
      {confirm && (
        <Modal
          title={
            confirm === "reset"
              ? "Reset this workspace?"
              : "Clear all training history?"
          }
          onClose={() => setConfirm(null)}
        >
          <p>
            This deletes{" "}
            {confirm === "reset"
              ? "your profile, preferences, and progress"
              : "sessions, workout progress, XP and milestones"}
            . Download a backup first if you want to keep it.
          </p>
          <button onClick={() => backup(data)}>Download backup</button>
          <div className="modal-actions">
            <button onClick={() => setConfirm(null)}>Cancel</button>
            <button
              className="danger"
              onClick={() => {
                void update((d) =>
                  confirm === "reset"
                    ? defaults()
                    : { ...d, sessions: [], workouts: [] },
                ).then((saved) => {
                  if (!saved) return;
                  setConfirm(null);
                  notify("Workspace updated.");
                });
              }}
            >
              Confirm deletion
            </button>
          </div>
        </Modal>
      )}
      {incoming && (
        <Modal
          title="Restore validated backup"
          onClose={() => setIncoming(null)}
        >
          <p>
            {incoming.sessions.length} sessions and {incoming.workouts.length}{" "}
            workouts found. Your current workspace will be downloaded as a
            safety backup before restoring.
          </p>
          <div className="modal-actions">
            <button
              onClick={() => {
                backup(data);
                void update((d) => mergeData(d, incoming)).then((saved) => {
                  if (!saved) return;
                  setIncoming(null);
                  notify("Backup merged successfully.");
                });
              }}
            >
              Merge progress
            </button>
            <button
              className="primary"
              onClick={() => {
                backup(data);
                void update(() => incoming).then((saved) => {
                  if (!saved) return;
                  setIncoming(null);
                  notify("Backup restored successfully.");
                });
              }}
            >
              Replace workspace
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
