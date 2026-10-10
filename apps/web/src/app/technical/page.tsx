import Link from "next/link";
import { ArrowLeft, Binary, Braces, Cpu, FlaskConical, GitBranch, ShieldCheck } from "lucide-react";

const stages = ["Clock + environment", "Needs evolve", "Observe + constrain", "Choose action", "Resolve + execute", "Reward + Q update", "Metrics + snapshot"];

export default function TechnicalPage() {
  return <main className="technical-page">
    <header className="technical-header"><Link href="/"><ArrowLeft size={15}/> Return to live city</Link><div className="brand"><div className="brand-glyph"><i/><i/><i/></div><div><strong>SYNAPSE CITY</strong><span>Engineering brief · schema v1</span></div></div></header>
    <section className="technical-hero"><span className="eyebrow">Inside the intelligence</span><h1>A small algorithm.<br/><em>Real consequences.</em></h1><p>This project separates simulation, learning and visualization so every visible claim can be traced to deterministic state transitions and measured experiments.</p><div className="fact-row"><span><Binary/> Tabular Q-learning</span><span><Cpu/> Web Worker runtime</span><span><ShieldCheck/> Seeded replay</span></div></section>
    <section className="technical-grid">
      <article className="tech-card span-2"><span className="card-index">01 / ENGINE</span><h2>One source of truth</h2><p>The framework-independent TypeScript engine owns agents, economy, rewards, relationships and events. React and Three.js only render immutable snapshots. The browser Worker executes the exact engine used by headless evaluations.</p><div className="architecture-flow"><b>UI / THREE.JS</b><i>snapshot</i><b>WEB WORKER</b><i>commands</i><b>SIMULATION CORE</b></div></article>
      <article className="tech-card"><span className="card-index">02 / DETERMINISM</span><GitBranch/><h2>Replayable by construction</h2><p>A serializable seeded PRNG replaces Math.random in domain rules. Same seed, policy and interventions produce the same state and event history.</p><code>state(t+1) = F(state(t), action, seed)</code></article>
      <article className="tech-card"><span className="card-index">03 / POLICY</span><Braces/><h2>Hybrid decisions</h2><p>Need-weighted utility supplies safe priors. Q-learning adds experience. Epsilon-greedy exploration decays from 0.22 to 0.025.</p><code>Q ← Q + α[r + γ max Q′ − Q]</code></article>
      <article className="tech-card span-2"><span className="card-index">04 / TICK PIPELINE</span><h2>Discrete time, explicit order</h2><div className="tick-flow">{stages.map((stage,index) => <div key={stage}><b>{String(index+1).padStart(2,"0")}</b><span>{stage}</span></div>)}</div></article>
      <article className="tech-card"><span className="card-index">05 / REWARD</span><FlaskConical/><h2>Observable reward</h2><p>Reward combines the delta in wellbeing, valid economic or social outcomes, and health penalties. Satisfaction and hunger remain independent evaluation metrics to expose reward hacking.</p></article>
      <article className="tech-card"><span className="card-index">06 / LIMITS</span><ShieldCheck/><h2>Honest boundaries</h2><p>This is a bounded artificial economy, not a macroeconomic model. Movement uses continuous waypoint travel, while full obstacle-aware A* routing and durable cloud persistence remain future extensions.</p></article>
    </section>
    <section className="methodology"><div><span className="eyebrow">Evaluation protocol</span><h2>Comparable policies, identical worlds.</h2></div><div><p>Each browser evaluation runs random-valid, heuristic and Q-learning policies on four held-out seeds for 420 ticks. The displayed satisfaction, reward and hunger are computed after those runs—never prefilled.</p><ol><li>Reset with identical seed and population</li><li>Run isolated headless episode</li><li>Collect independent outcome metrics</li><li>Aggregate arithmetic means across seeds</li></ol></div></section>
    <footer className="technical-footer"><span>SYNAPSE CITY / ENGINEERING NOTE 001</span><Link href="/">Launch the live laboratory →</Link></footer>
  </main>;
}
