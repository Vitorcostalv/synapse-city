/// <reference lib="webworker" />
import { evaluatePolicies, ExperimentKind, PolicyKind, Simulation, WorldSnapshot } from "@synapse/simulation";

type Command =
  | { type: "play" }
  | { type: "pause" }
  | { type: "step" }
  | { type: "speed"; value: number }
  | { type: "reset"; seed: number }
  | { type: "policy"; value: PolicyKind }
  | { type: "experiment"; value: ExperimentKind }
  | { type: "restore"; snapshot: WorldSnapshot }
  | { type: "evaluate" };

let simulation = new Simulation();
let playing = true;
let speed = 1;

const publish = () => postMessage({ type: "snapshot", snapshot: simulation.snapshot() });
const timer = setInterval(() => {
  if (!playing) return;
  simulation.tick(speed);
  publish();
}, 150);

self.onmessage = (event: MessageEvent<Command>) => {
  const command = event.data;
  if (command.type === "play") playing = true;
  if (command.type === "pause") playing = false;
  if (command.type === "speed") speed = command.value;
  if (command.type === "step") { simulation.tick(); publish(); }
  if (command.type === "reset") { simulation = new Simulation({ seed: command.seed }); publish(); }
  if (command.type === "policy") { simulation.setPolicy(command.value); publish(); }
  if (command.type === "experiment") { simulation.applyExperiment(command.value); publish(); }
  if (command.type === "restore") { simulation = Simulation.fromSnapshot(command.snapshot); publish(); }
  if (command.type === "evaluate") {
    const started = performance.now();
    const results = evaluatePolicies();
    postMessage({ type: "evaluation", results, durationMs: performance.now() - started });
  }
};

publish();
self.addEventListener("close", () => clearInterval(timer));
