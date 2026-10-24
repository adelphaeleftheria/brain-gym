import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Play from "../games/Play";
import { getGame } from "../games/registry";
import type { Session } from "../domain/model";
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
function mount(id: string) {
  const finish = vi.fn(async (_s: Session) => {});
  render(
    <Play
      game={getGame(id)}
      difficulty="Easy"
      onFinish={finish}
      sound={false}
      volume={0}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Start exercise →" }));
  return finish;
}
describe("core games", () => {
  it("blocks memory input during playback and completes after a wrong answer", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const finish = mount("memory");
    expect(screen.getByRole("button", { name: /Tile 2/ })).toBeDisabled();
    act(() => vi.advanceTimersByTime(2400));
    fireEvent.click(screen.getByRole("button", { name: /Tile 2/ }));
    await act(async () => vi.advanceTimersByTime(1000));
    expect(finish).toHaveBeenCalledTimes(1);
    expect(finish.mock.calls[0][0].accuracy).toBe(0);
  });
  it("math accepts ten integer answers and ends once", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const finish = mount("math");
    for (let i = 0; i < 10; i++) {
      fireEvent.change(screen.getByRole("textbox", { name: "Your answer" }), {
        target: { value: "2" },
      });
      fireEvent.click(screen.getByRole("button", { name: /Check answer/ }));
      await act(async () => vi.advanceTimersByTime(1100));
    }
    expect(finish).toHaveBeenCalledTimes(1);
    expect(finish.mock.calls[0][0].correct).toBe(10);
  });
  it("logic explains the rule and completes eight answers", async () => {
    const finish = mount("logic");
    for (let i = 0; i < 8; i++) {
      const buttons = [...document.querySelectorAll(".answers button")];
      fireEvent.click(buttons[0]);
      expect(screen.getByRole("status").textContent).toMatch(
        /Add|Multiply|Alternate|Repeat|remainder|missing/,
      );
      await act(async () => vi.advanceTimersByTime(1100));
    }
    expect(finish).toHaveBeenCalledTimes(1);
  });
  it("focus tracks false selections and completes three grids", async () => {
    const finish = mount("focus");
    for (let grid = 0; grid < 3; grid++) {
      fireEvent.click(
        screen
          .getAllByRole("button")
          .find(
            (b) =>
              b.textContent === "R" ||
              b.textContent === "H" ||
              b.textContent === "N" ||
              b.textContent === "V",
          )!,
      );
      for (const b of screen
        .getAllByRole("button")
        .filter((b) => b.textContent === "A"))
        fireEvent.click(b);
      await act(async () => vi.advanceTimersByTime(700));
    }
    expect(finish).toHaveBeenCalledTimes(1);
    expect(finish.mock.calls[0][0].metrics.falseSelections).toBe(3);
  });
  it("reaction rejects false starts, records five valid rounds and prevents duplicate results", async () => {
    const finish = mount("reaction");
    fireEvent.click(screen.getByRole("button", { name: /Ready/ }));
    fireEvent.click(screen.getByRole("button", { name: /Wait/ }));
    expect(screen.getByRole("status")).toHaveTextContent("Too soon");
    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByRole("button", { name: /Ready/ }));
      await act(async () => vi.advanceTimersByTime(4600));
      expect(screen.getByRole("button", { name: /GO!/ })).toBeInTheDocument();
      act(() => vi.advanceTimersByTime(250));
      fireEvent.click(screen.getByRole("button", { name: /GO!/ }));
    }
    await act(async () => vi.advanceTimersByTime(800));
    expect(finish).toHaveBeenCalledTimes(1);
    const s = finish.mock.calls[0][0];
    expect(s.metrics.falseStarts).toBe(1);
    expect(s.metrics.averageMs).toBeGreaterThanOrEqual(80);
    expect(s.attempts).toBe(6);
  });
});
describe("additional games", () => {
  it("number memory hides digits, validates exact answers and completes", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const finish = mount("numbers");
    for (let i = 0; i < 5; i++) {
      await act(async () => vi.advanceTimersByTime(2300));
      fireEvent.change(
        screen.getByRole("textbox", { name: "Remembered number" }),
        { target: { value: "0".repeat(3 + i) } },
      );
      fireEvent.click(screen.getByRole("button", { name: "Check answer" }));
      await act(async () => vi.advanceTimersByTime(950));
    }
    expect(finish.mock.calls[0][0].metrics.digits).toBe(7);
    expect(finish.mock.calls[0][0].correct).toBe(5);
  });
  for (const id of ["words", "spatial", "nback", "color", "sequence"])
    it(`${id} plays to a persisted result`, async () => {
      const finish = mount(id),
        rounds = id === "nback" ? 17 : id === "color" ? 12 : 8;
      for (let i = 0; i < rounds; i++) {
        if (id === "words") {
          fireEvent.click(screen.getByRole("button", { name: "Skip word" }));
        } else {
          const group = document.querySelector(".answers")!;
          fireEvent.click(group.querySelector("button")!);
        }
        await act(async () => vi.advanceTimersByTime(1150));
      }
      expect(finish).toHaveBeenCalledTimes(1);
      expect(finish.mock.calls[0][0].attempts).toBe(
        id === "nback" ? 16 : rounds,
      );
    });
});
it("memory successfully grows the sequence through all six rounds", async () => {
  vi.spyOn(Math, "random").mockReturnValue(0);
  const finish = mount("memory");
  for (let r = 0; r < 6; r++) {
    act(() => vi.advanceTimersByTime(7500));
    for (let j = 0; j < 2 + r; j++) {
      fireEvent.click(screen.getByRole("button", { name: /^Tile 1(?:,|$)/ }));
      act(() => vi.advanceTimersByTime(170));
    }
    act(() => vi.advanceTimersByTime(700));
  }
  await act(async () => vi.advanceTimersByTime(1000));
  expect(finish).toHaveBeenCalledTimes(1);
  expect(finish.mock.calls[0][0].metrics.span).toBe(7);
  expect(finish.mock.calls[0][0].accuracy).toBe(100);
});
