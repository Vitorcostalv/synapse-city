import { expect, test } from "@playwright/test";

test("local city runs and exposes a real decision trace", async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  await page.goto("/");
  await expect(page.getByText("LOCAL LAB")).toBeVisible();
  await expect(page.getByText("Browser-resident engine")).toBeVisible();
  await expect(page.locator(".scene-loading")).toBeHidden({ timeout: 15_000 });
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: "Inspect citizen 001" }).click();
  await expect(page.getByText("Decision trace")).toBeVisible();
  await expect(page.getByText("Learned action values")).toBeVisible();
  if (testInfo.project.name === "desktop-chromium") {
    await page.screenshot({ path: "../../docs/screenshots/lab-desktop.png", fullPage: true });
  } else {
    await page.screenshot({ path: "../../docs/screenshots/lab-mobile.png", fullPage: true });
  }
  expect(consoleErrors.filter((error) => !error.includes("THREE.WebGLRenderer"))).toEqual([]);
});

test("controlled experiment writes an audit event", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Experiments" }).click();
  await page.getByRole("button", { name: /Food scarcity/ }).click();
  await expect(page.getByText(/scarcity scenario activated/i)).toBeVisible();
});

test("technical brief explains the actual algorithm", async ({ page }) => {
  await page.goto("/technical");
  await expect(page.getByRole("heading", { name: /A small algorithm/ })).toBeVisible();
  await expect(page.getByText("Q ← Q + α[r + γ max Q′ − Q]")).toBeVisible();
});
