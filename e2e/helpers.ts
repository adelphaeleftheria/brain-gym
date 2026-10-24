import type { Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type { Data } from "../src/domain/model";
export async function ready(page: Page) {
  await page.goto("./");
  await page.getByRole("button", { name: "Skip for now" }).click();
}
export async function begin(page: Page, name: string, difficulty = "Normal") {
  await page.getByRole("link", { name: "Train", exact: true }).click();
  await page.getByRole("button", { name: new RegExp(name) }).click();
  await page.locator(".difficulty-select select").selectOption(difficulty);
  await page.getByRole("button", { name: "Start exercise →" }).click();
}
export async function exported(page: Page): Promise<Data> {
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export full backup ↓" }).click();
  const file = await (await pending).path();
  return JSON.parse(await readFile(file!, "utf8")).data;
}
export function solveLogic(prompt: string, options: string[]) {
  const nums = (prompt.match(/-?\d+/g) || []).map(Number);
  if (prompt.startsWith("Repeat")) return (prompt.match(/[○△□◇]/g) || [])[0];
  if (prompt.includes("NOT"))
    return options.find((v) => Number(v) % nums[0] !== 0)!;
  if (prompt.startsWith("Same")) return String(nums[4] * (nums[1] / nums[0]));
  if (prompt.startsWith("Constant")) return String(nums[1] + nums[1] - nums[0]);
  const [a, b, c, d] = nums;
  return String(
    b - a === c - b && c - b === d - c
      ? d + (b - a)
      : b / a === c / b && c / b === d / c
        ? d * (b / a)
        : d + (c - b),
  );
}
