export const ACTIONS = ["work", "eat", "rest", "study", "socialize", "explore"] as const;
export type Action = (typeof ACTIONS)[number];
export type PolicyKind = "random" | "heuristic" | "q-learning";
export type ExperimentKind = "none" | "scarcity" | "unemployment" | "shock" | "isolation";

export type Vec2 = { x: number; z: number };
export type Needs = { hunger: number; energy: number; social: number; growth: number };
export type Experience = {
  state: string;
  action: Action;
  reward: number;
  nextState: string;
  tick: number;
};
export type DecisionTrace = {
  state: string;
  validActions: Action[];
  utilities: Record<Action, number>;
  qValues: Record<Action, number>;
  chosen: Action;
  reward: number;
  epsilon: number;
  reason: string;
};
export type Agent = {
  id: string;
  name: string;
  age: number;
  profile: string;
  profession: string;
  position: Vec2;
  target: Vec2;
  path: Vec2[];
  money: number;
  food: number;
  health: number;
  happiness: number;
  stress: number;
  curiosity: number;
  sociability: number;
  needs: Needs;
  action: Action;
  previousAction: Action;
  totalReward: number;
  qTable: Record<string, Partial<Record<Action, number>>>;
  memory: Experience[];
  relationships: Record<string, number>;
  trace: DecisionTrace;
};
export type CityMetrics = {
  tick: number;
  day: number;
  hour: number;
  population: number;
  satisfaction: number;
  hunger: number;
  wealth: number;
  unemployment: number;
  interactions: number;
  transactions: number;
  averageReward: number;
  foodStock: number;
  gini: number;
};
export type CityEvent = {
  id: string;
  tick: number;
  type: "ACTION_COMPLETED" | "TRANSACTION_COMPLETED" | "RELATIONSHIP_CHANGED" | "POLICY_UPDATED" | "EXPERIMENT_STARTED";
  message: string;
  agentId?: string;
};
export type WorldSnapshot = {
  schemaVersion: 1;
  seed: number;
  rngState: number;
  tick: number;
  policy: PolicyKind;
  experiment: ExperimentKind;
  agents: Agent[];
  treasury: number;
  foodStock: number;
  metrics: CityMetrics;
  history: CityMetrics[];
  events: CityEvent[];
  epsilon: number;
};
export type SimulationConfig = {
  seed: number;
  population: number;
  policy: PolicyKind;
  epsilon: number;
  learningRate: number;
  discount: number;
};

export const DEFAULT_CONFIG: SimulationConfig = {
  seed: 7319,
  population: 48,
  policy: "q-learning",
  epsilon: 0.22,
  learningRate: 0.18,
  discount: 0.88,
};
