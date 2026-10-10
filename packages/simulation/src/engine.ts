import { SeededRng } from "./rng";
import { cityBlockedCells, findPath } from "./pathfinding";
import {
  ACTIONS,
  Agent,
  Action,
  CityMetrics,
  DEFAULT_CONFIG,
  DecisionTrace,
  ExperimentKind,
  PolicyKind,
  SimulationConfig,
  Vec2,
  WorldSnapshot,
} from "./types";

const NAMES = ["Mara", "Ivo", "Lena", "Caio", "Nina", "Theo", "Yara", "Ravi", "Clara", "Noah", "Ayla", "Davi", "Lia", "Gael", "Cora", "Bento"];
const PROFILES = ["Disciplined", "Social", "Curious", "Cautious", "Economic", "Student", "Merchant", "Explorer"];
const LOCATIONS: Record<Action, Vec2> = {
  work: { x: 4, z: -5 }, eat: { x: -4, z: 1 }, rest: { x: -5, z: -1 },
  study: { x: 4, z: 5 }, socialize: { x: 0, z: 0 }, explore: { x: 8, z: 4 },
};
const BLOCKED = cityBlockedCells();

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const round = (value: number, digits = 2) => Number(value.toFixed(digits));
const blankScores = (): Record<Action, number> => ({ work: 0, eat: 0, rest: 0, study: 0, socialize: 0, explore: 0 });

export class Simulation {
  readonly config: SimulationConfig;
  rng: SeededRng;
  state: WorldSnapshot;

  constructor(input: Partial<SimulationConfig> = {}, restored?: WorldSnapshot) {
    this.config = { ...DEFAULT_CONFIG, ...input };
    this.rng = new SeededRng(restored?.rngState ?? this.config.seed);
    this.state = restored ? structuredClone(restored) : this.createWorld();
  }

  private createWorld(): WorldSnapshot {
    const agents = Array.from({ length: this.config.population }, (_, index) => this.createAgent(index));
    const metrics = this.computeMetrics(agents, 0, 0, 0, 520);
    return {
      schemaVersion: 1, seed: this.config.seed, rngState: this.rng.state, tick: 0,
      policy: this.config.policy, experiment: "none", agents, treasury: 5000,
      foodStock: 520, metrics, history: [metrics], events: [], epsilon: this.config.epsilon,
    };
  }

  private createAgent(index: number): Agent {
    const profile = PROFILES[index % PROFILES.length];
    const action: Action = "explore";
    const trace: DecisionTrace = { state: "initial", validActions: [...ACTIONS], utilities: blankScores(), qValues: blankScores(), chosen: action, reward: 0, epsilon: this.config.epsilon, reason: "Initial orientation" };
    return {
      id: `citizen-${String(index + 1).padStart(3, "0")}`,
      name: `${NAMES[index % NAMES.length]} ${String.fromCharCode(65 + (index % 20))}.`,
      age: 19 + this.rng.int(43), profile, profession: index % 7 === 0 ? "Unemployed" : ["Engineer", "Cook", "Teacher", "Nurse", "Builder", "Analyst"][index % 6],
      position: index % 2 ? { x: this.rng.next() * 18 - 9, z: this.rng.next() > .5 ? 2 : -2 } : { x: this.rng.next() > .5 ? 2 : -2, z: this.rng.next() * 18 - 9 },
      target: { x: this.rng.next() * 4 - 2, z: this.rng.next() * 4 - 2 },
      path: [],
      money: 34 + this.rng.int(95), food: 1 + this.rng.int(3), health: 78 + this.rng.int(22),
      happiness: 55 + this.rng.int(25), stress: 12 + this.rng.int(18), curiosity: 35 + this.rng.int(60),
      sociability: 30 + this.rng.int(65), needs: { hunger: 12 + this.rng.int(38), energy: 55 + this.rng.int(40), social: 15 + this.rng.int(45), growth: 20 + this.rng.int(45) },
      action, previousAction: action, totalReward: 0, qTable: {}, memory: [], relationships: {}, trace,
    };
  }

  private stateKey(agent: Agent): string {
    const bucket = (v: number) => (v < 34 ? "L" : v < 67 ? "M" : "H");
    const cash = agent.money < 12 ? "poor" : agent.money < 55 ? "stable" : "secure";
    return `h${bucket(agent.needs.hunger)}-e${bucket(agent.needs.energy)}-s${bucket(agent.needs.social)}-g${bucket(agent.needs.growth)}-${cash}`;
  }

  private validActions(agent: Agent): Action[] {
    return ACTIONS.filter((action) => {
      if (action === "eat") return agent.food > 0 || (agent.money >= this.foodPrice() && this.state.foodStock > 0);
      if (action === "work") return agent.profession !== "Unemployed" && agent.needs.energy > 12 && this.state.treasury >= 5;
      if (action === "study") return agent.money >= 1 && agent.needs.energy > 9;
      if (action === "socialize") return this.state.experiment !== "isolation" || this.rng.next() > 0.7;
      return true;
    });
  }

  private utilities(agent: Agent): Record<Action, number> {
    const p = agent.profile;
    return {
      eat: agent.needs.hunger * 1.35 + (agent.food ? 12 : 0),
      rest: (100 - agent.needs.energy) * 1.3 + agent.stress * 0.25,
      work: (70 - Math.min(70, agent.money)) * 0.75 + (p === "Disciplined" ? 16 : 0),
      study: agent.needs.growth * 0.7 + agent.curiosity * 0.35 + (p === "Student" ? 18 : 0),
      socialize: agent.needs.social * 0.9 + agent.sociability * 0.32 + (p === "Social" ? 18 : 0),
      explore: agent.curiosity * 0.48 + agent.needs.growth * 0.28 + (p === "Explorer" ? 20 : 0),
    };
  }

  private choose(agent: Agent, stateKey: string, valid: Action[]): { action: Action; utilities: Record<Action, number>; q: Record<Action, number>; reason: string } {
    const utilities = this.utilities(agent);
    const q = { ...blankScores(), ...(agent.qTable[stateKey] ?? {}) };
    if (this.state.policy === "random") return { action: this.rng.pick(valid), utilities, q, reason: "Valid random baseline" };
    const heuristic = valid.reduce((best, current) => utilities[current] > utilities[best] ? current : best, valid[0]);
    if (this.state.policy === "heuristic") return { action: heuristic, utilities, q, reason: "Highest need-weighted utility" };
    if (this.rng.next() < this.state.epsilon) return { action: this.rng.pick(valid), utilities, q, reason: "Epsilon exploration" };
    const action = valid.reduce((best, current) => (q[current] + utilities[current] * 0.42) > (q[best] + utilities[best] * 0.42) ? current : best, valid[0]);
    return { action, utilities, q, reason: q[action] === 0 ? "Utility prior for unseen state" : "Learned value plus utility prior" };
  }

  private evolveNeeds(agent: Agent): void {
    agent.needs.hunger = clamp(agent.needs.hunger + 1.1);
    agent.needs.energy = clamp(agent.needs.energy - 0.72);
    agent.needs.social = clamp(agent.needs.social + 0.42);
    agent.needs.growth = clamp(agent.needs.growth + 0.18);
    agent.stress = clamp(agent.stress + (agent.needs.hunger > 78 ? 1.2 : -0.15));
    agent.health = clamp(agent.health - (agent.needs.hunger > 90 ? 0.7 : 0));
  }

  private move(agent: Agent): void {
    const waypoint = agent.path[0] ?? agent.target;
    const dx = waypoint.x - agent.position.x;
    const dz = waypoint.z - agent.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance > 0.18) {
      const step = Math.min(0.34, distance);
      agent.position.x += (dx / distance) * step;
      agent.position.z += (dz / distance) * step;
    } else if (agent.path.length) agent.path.shift();
  }

  private execute(agent: Agent, action: Action): { reward: number; transaction: boolean; interaction: boolean } {
    const before = this.wellbeing(agent);
    let transaction = false;
    let interaction = false;
    if (action === "eat") {
      if (agent.food <= 0) {
        const price = this.foodPrice();
        if (agent.money >= price && this.state.foodStock > 0) { agent.money -= price; this.state.treasury += price; this.state.foodStock--; agent.food++; transaction = true; }
      }
      if (agent.food > 0) { agent.food--; agent.needs.hunger = clamp(agent.needs.hunger - 48); agent.health = clamp(agent.health + 1.4); }
    } else if (action === "rest") {
      agent.needs.energy = clamp(agent.needs.energy + 32); agent.stress = clamp(agent.stress - 9);
    } else if (action === "work") {
      const wage = this.state.experiment === "shock" ? 4 : 7;
      if (this.state.treasury >= wage) { this.state.treasury -= wage; agent.money += wage; transaction = true; }
      agent.needs.energy = clamp(agent.needs.energy - 8); agent.stress = clamp(agent.stress + 2); this.state.foodStock += 0.22;
    } else if (action === "study") {
      agent.money -= 1; this.state.treasury += 1; agent.needs.growth = clamp(agent.needs.growth - 28); agent.curiosity = clamp(agent.curiosity + 0.35); transaction = true;
    } else if (action === "socialize") {
      const candidates = this.state.agents.filter((other) => other.id !== agent.id);
      const other = candidates[this.rng.int(candidates.length)];
      const gain = 1 + this.rng.next() * 2;
      agent.relationships[other.id] = clamp((agent.relationships[other.id] ?? 0) + gain);
      agent.needs.social = clamp(agent.needs.social - 34); agent.happiness = clamp(agent.happiness + 2); interaction = true;
    } else {
      agent.needs.growth = clamp(agent.needs.growth - 9); agent.happiness = clamp(agent.happiness + 0.6);
    }
    if (action !== agent.previousAction || agent.path.length === 0) {
      agent.target = { ...LOCATIONS[action] };
      agent.path = findPath(agent.position, agent.target, BLOCKED);
    }
    const after = this.wellbeing(agent);
    const penalty = agent.health < 45 ? 1.5 : 0;
    return { reward: round((after - before) * 0.7 + (transaction ? 0.2 : 0) + (interaction ? 0.35 : 0) - penalty, 3), transaction, interaction };
  }

  private wellbeing(agent: Agent): number {
    return (100 - agent.needs.hunger) * 0.28 + agent.needs.energy * 0.22 + (100 - agent.needs.social) * 0.12 + (100 - agent.needs.growth) * 0.08 + agent.health * 0.2 + agent.happiness * 0.1;
  }

  private learn(agent: Agent, state: string, action: Action, reward: number, nextState: string): void {
    if (this.state.policy !== "q-learning") return;
    const current = agent.qTable[state]?.[action] ?? 0;
    const nextValues = Object.values(agent.qTable[nextState] ?? {});
    const nextMax = nextValues.length ? Math.max(...nextValues) : 0;
    const updated = current + this.config.learningRate * (reward + this.config.discount * nextMax - current);
    agent.qTable[state] = { ...(agent.qTable[state] ?? {}), [action]: round(updated, 4) };
  }

  tick(steps = 1): WorldSnapshot {
    for (let step = 0; step < steps; step++) {
      this.state.tick++;
      let transactions = 0;
      let interactions = 0;
      for (const agent of this.state.agents) {
        this.evolveNeeds(agent); this.move(agent);
        const stateKey = this.stateKey(agent);
        const valid = this.validActions(agent);
        const decision = this.choose(agent, stateKey, valid);
        agent.previousAction = agent.action; agent.action = decision.action;
        const outcome = this.execute(agent, decision.action);
        transactions += Number(outcome.transaction); interactions += Number(outcome.interaction);
        const nextState = this.stateKey(agent);
        this.learn(agent, stateKey, decision.action, outcome.reward, nextState);
        agent.totalReward += outcome.reward;
        agent.memory.push({ state: stateKey, action: decision.action, reward: outcome.reward, nextState, tick: this.state.tick });
        if (agent.memory.length > 18) agent.memory.shift();
        agent.trace = { state: stateKey, validActions: valid, utilities: decision.utilities, qValues: { ...blankScores(), ...(agent.qTable[stateKey] ?? {}) }, chosen: decision.action, reward: outcome.reward, epsilon: this.state.epsilon, reason: decision.reason };
      }
      this.state.epsilon = Math.max(0.025, this.state.epsilon * 0.9993);
      this.state.rngState = this.rng.state;
      this.state.metrics = this.computeMetrics(this.state.agents, this.state.tick, interactions, transactions, this.state.foodStock);
      if (this.state.tick % 4 === 0) { this.state.history.push(this.state.metrics); if (this.state.history.length > 180) this.state.history.shift(); }
      if (this.state.tick % 25 === 0) this.event("POLICY_UPDATED", `Policy updated · ε ${this.state.epsilon.toFixed(3)}`);
    }
    return this.snapshot();
  }

  private foodPrice(): number { return this.state.experiment === "shock" ? 9 : this.state.experiment === "scarcity" ? 7 : 4; }

  private computeMetrics(agents: Agent[], tick: number, interactions: number, transactions: number, foodStock: number): CityMetrics {
    const avg = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
    const monies = agents.map((a) => a.money).sort((a, b) => a - b);
    const total = monies.reduce((a, b) => a + b, 0);
    let weighted = 0; monies.forEach((value, index) => weighted += (index + 1) * value);
    const gini = total ? (2 * weighted) / (monies.length * total) - (monies.length + 1) / monies.length : 0;
    return {
      tick, day: Math.floor(tick / 96) + 1, hour: Math.floor((tick % 96) / 4), population: agents.length,
      satisfaction: round(avg(agents.map((a) => this.wellbeing(a)))), hunger: round(avg(agents.map((a) => a.needs.hunger))),
      wealth: round(avg(monies)), unemployment: round((agents.filter((a) => a.profession === "Unemployed").length / agents.length) * 100),
      interactions, transactions, averageReward: round(avg(agents.map((a) => a.totalReward / Math.max(1, tick)))),
      foodStock: Math.floor(foodStock), gini: round(gini, 3),
    };
  }

  applyExperiment(kind: ExperimentKind): void {
    this.state.experiment = kind;
    if (kind === "scarcity") this.state.foodStock = Math.max(12, Math.floor(this.state.foodStock * 0.18));
    if (kind === "unemployment") this.state.agents.forEach((agent, index) => { if (index % 3 === 0) agent.profession = "Unemployed"; });
    this.event("EXPERIMENT_STARTED", kind === "none" ? "Controls restored" : `${kind} scenario activated`);
  }

  setPolicy(policy: PolicyKind): void { this.state.policy = policy; }
  snapshot(): WorldSnapshot { return structuredClone(this.state); }
  static fromSnapshot(snapshot: WorldSnapshot): Simulation {
    if (snapshot.schemaVersion !== 1) throw new Error("Unsupported snapshot schema");
    return new Simulation({ seed: snapshot.seed, population: snapshot.agents.length, policy: snapshot.policy, epsilon: snapshot.epsilon }, snapshot);
  }
  private event(type: WorldSnapshot["events"][number]["type"], message: string, agentId?: string): void {
    this.state.events.unshift({ id: `${this.state.tick}-${this.rng.state}`, tick: this.state.tick, type, message, ...(agentId ? { agentId } : {}) });
    if (this.state.events.length > 40) this.state.events.pop();
  }
}
