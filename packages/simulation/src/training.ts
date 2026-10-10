import { Simulation } from "./engine";
import { PolicyKind } from "./types";

export type EvaluationResult = { policy: PolicyKind; satisfaction: number; averageReward: number; hunger: number; runs: number };

export function evaluatePolicies(seeds = [101, 307, 911, 1217], ticks = 420, trainingTicks = 1_800): EvaluationResult[] {
  return (["random", "heuristic", "q-learning"] as PolicyKind[]).map((policy) => {
    const results = seeds.map((seed) => {
      const sim = new Simulation({ seed, population: 36, policy, epsilon: 0 });
      if (policy === "q-learning") {
        const trainer = new Simulation({ seed: seed + 50_000, population: 36, policy, epsilon: 0.32 });
        trainer.tick(trainingTicks);
        sim.state.agents.forEach((agent, index) => {
          agent.qTable = structuredClone(trainer.state.agents[index].qTable);
        });
      }
      sim.tick(ticks);
      return sim.state.metrics;
    });
    const avg = (key: "satisfaction" | "averageReward" | "hunger") => results.reduce((sum, result) => sum + result[key], 0) / results.length;
    return { policy, satisfaction: Number(avg("satisfaction").toFixed(2)), averageReward: Number(avg("averageReward").toFixed(3)), hunger: Number(avg("hunger").toFixed(2)), runs: seeds.length };
  });
}
