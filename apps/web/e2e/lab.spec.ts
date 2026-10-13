import { expect, test } from "@playwright/test";

test("local city runs and exposes a real decision trace", async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  await page.goto("/");
  await expect(page.getByText("LOCAL LAB")).toBeVisible();
  await expect(page.getByText("Browser-resident engine")).toBeVisible();
  await expect(page.locator(".scene-loading")).toBeHidden({ timeout: 15_000 });
  await expect(page.locator("canvas")).toBeVisible();
  // Let the larger procedural scene finish its first shader/material pass before documentation capture.
  await page.waitForTimeout(3_000);
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

test("browser checkpoint survives a page refresh", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Pause simulation" }).click();
  await page.getByRole("button", { name: "Experiments" }).click();
  await page.getByRole("button", { name: "Save checkpoint" }).click();
  const savedTick = await page.evaluate(() => {
    const saved = localStorage.getItem("synapse-city-snapshot");
    return saved ? (JSON.parse(saved) as { tick: number }).tick : null;
  });
  expect(savedTick).not.toBeNull();
  await page.reload();
  await page.getByRole("button", { name: "Pause simulation" }).click();
  await page.getByRole("button", { name: "Experiments" }).click();
  await page.getByRole("button", { name: "Load checkpoint" }).click();
  await expect(page.locator(".tick-readout b")).toHaveText(savedTick!.toLocaleString());
});

test("evidence panel renders live metrics", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Evidence" }).click();
  await expect(page.getByRole("heading", { name: "Measured, not narrated." })).toBeVisible();
  await expect(page.getByText("Live satisfaction")).toBeVisible();
  await expect(page.locator(".recharts-responsive-container")).toBeVisible();
});

test("3D scene survives sustained simulation and citizen selection", async ({ page }) => {
  test.slow();
  const consoleErrors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "5×" }).click();
  await page.waitForTimeout(15_000);
  await page.getByRole("button", { name: "Inspect citizen 001" }).click();
  await page.waitForTimeout(1_000);
  const contextLost = await page.locator("canvas").evaluate((canvas) => {
    const gl = (canvas as HTMLCanvasElement).getContext("webgl2");
    return !gl || gl.isContextLost();
  });
  expect(contextLost).toBe(false);
  expect(consoleErrors.filter((error) => !error.includes("favicon"))).toEqual([]);
});

test("configured gateway health is surfaced without owning the simulation", async ({ page }) => {
  test.skip(process.env.PLAYWRIGHT_EXPECT_GATEWAY !== "true", "Only runs against a deployment with the optional gateway configured");
  await page.goto("/");
  await expect(page.locator(".gateway-status")).toHaveAttribute("data-state", "online", { timeout: 25_000 });
  await expect(page.getByText("Browser-resident engine")).toBeVisible();
});

test("technical brief explains the actual algorithm", async ({ page }) => {
  await page.goto("/technical");
  await expect(page.getByRole("heading", { name: /A small algorithm/ })).toBeVisible();
  await expect(page.getByText("Q ← Q + α[r + γ max Q′ − Q]")).toBeVisible();
});
