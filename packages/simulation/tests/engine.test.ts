import { describe, expect, it } from "vitest";
import { SeededRng, Simulation, cityBlockedCells, evaluatePolicies, findPath } from "../src";

describe("deterministic simulation", () => {
  it("replays the same seed exactly", () => {
    const first = new Simulation({ seed: 42, population: 12 });
    const second = new Simulation({ seed: 42, population: 12 });
    first.tick(80); second.tick(80);
    expect(first.snapshot()).toEqual(second.snapshot());
  });

  it("round-trips a snapshot without changing the next transition", () => {
    const original = new Simulation({ seed: 808, population: 10 });
    original.tick(35);
    const restored = Simulation.fromSnapshot(JSON.parse(JSON.stringify(original.snapshot())));
    expect(restored.tick()).toEqual(original.tick());
  });

  it("keeps all needs and positions within domain bounds", () => {
    const simulation = new Simulation({ seed: 99, population: 24 });
    simulation.tick(500);
    for (const agent of simulation.state.agents) {
      expect(Object.values(agent.needs).every((value) => value >= 0 && value <= 100)).toBe(true);
      expect(Number.isFinite(agent.position.x + agent.position.z)).toBe(true);
      expect(agent.money).toBeGreaterThanOrEqual(0);
    }
  });

  it("does not sell food without stock or money", () => {
    const simulation = new Simulation({ seed: 7, population: 1, policy: "heuristic" });
    const agent = simulation.state.agents[0];
    simulation.state.foodStock = 0; agent.food = 0; agent.money = 0; agent.needs.hunger = 100;
    simulation.tick();
    expect(agent.food).toBe(0);
    expect(agent.money).toBe(0);
  });
});

describe("navigation", () => {
  it("finds a deterministic route around blocked buildings", () => {
    const blocked = cityBlockedCells();
    const path = findPath({ x: -10, z: -7 }, { x: -3, z: -3 }, blocked);
    expect(path.length).toBeGreaterThan(6);
    expect(path.every((point) => !blocked.has(`${point.x},${point.z}`))).toBe(true);
  });
});

describe("learning", () => {
  it("updates Q values from observed transitions", () => {
    const simulation = new Simulation({ seed: 13, population: 4, policy: "q-learning", epsilon: 0 });
    simulation.tick(20);
    expect(simulation.state.agents.some((agent) => Object.keys(agent.qTable).length > 0)).toBe(true);
    expect(simulation.state.agents.flatMap((agent) => Object.values(agent.qTable).flatMap(Object.values)).some((value) => value !== 0)).toBe(true);
  });

  it("uses a reproducible exploration sequence", () => {
    const a = new SeededRng(123); const b = new SeededRng(123);
    expect(Array.from({ length: 20 }, () => a.next())).toEqual(Array.from({ length: 20 }, () => b.next()));
  });

  it("evaluates all three policies using measured runs", () => {
    const result = evaluatePolicies([1, 2], 80, 30);
    expect(result.map((entry) => entry.policy)).toEqual(["random", "heuristic", "q-learning"]);
    expect(result.every((entry) => entry.runs === 2 && Number.isFinite(entry.satisfaction))).toBe(true);
  });
});

describe("society and interventions", () => {
  it("creates bounded relationship history", () => {
    const simulation = new Simulation({ seed: 22, population: 10, policy: "heuristic" });
    simulation.state.agents.forEach((agent) => { agent.needs.social = 100; agent.needs.hunger = 0; agent.needs.energy = 100; agent.needs.growth = 0; });
    simulation.tick(30);
    expect(simulation.state.agents.some((agent) => Object.keys(agent.relationships).length > 0)).toBe(true);
    expect(simulation.state.agents.every((agent) => agent.memory.length <= 18)).toBe(true);
  });

  it("applies scarcity as an auditable controlled intervention", () => {
    const simulation = new Simulation({ seed: 31 });
    const before = simulation.state.foodStock;
    simulation.applyExperiment("scarcity");
    expect(simulation.state.foodStock).toBeLessThan(before);
    expect(simulation.state.events[0].type).toBe("EXPERIMENT_STARTED");
  });
});
