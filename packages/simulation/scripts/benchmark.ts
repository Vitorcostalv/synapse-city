import { performance } from "node:perf_hooks";
import { Simulation, evaluatePolicies } from "../src/index";

const populations = [50, 100, 200];
const benchmark = populations.map((population) => {
  const sim = new Simulation({ seed: 7319, population });
  const start = performance.now();
  sim.tick(1_000);
  const durationMs = performance.now() - start;
  return { population, ticks: 1_000, durationMs: Number(durationMs.toFixed(2)), ticksPerSecond: Math.round(1_000 / (durationMs / 1_000)) };
});

console.log(JSON.stringify({ generatedAt: new Date().toISOString(), benchmark, evaluation: evaluatePolicies() }, null, 2));
