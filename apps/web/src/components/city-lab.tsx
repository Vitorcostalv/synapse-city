"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Agent, EvaluationResult, ExperimentKind, PolicyKind, WorldSnapshot } from "@synapse/simulation";
import { Activity, BookOpen, ChevronDown, CirclePause, CirclePlay, Download, FlaskConical, Gauge, RotateCcw, Save, SkipForward, Upload, Users, WifiOff, X } from "lucide-react";
import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MetricChart } from "./metric-chart";

const CityScene = dynamic(() => import("./city-scene").then((module) => module.CityScene), { ssr: false, loading: () => <div className="scene-loading"><span />Constructing urban model</div> });

const ACTION_LABELS: Record<string, string> = { work: "Working", eat: "Eating", rest: "Resting", study: "Studying", socialize: "Socializing", explore: "Exploring" };
const EXPERIMENTS: { id: ExperimentKind; label: string; note: string }[] = [
  { id: "scarcity", label: "Food scarcity", note: "Reduce market stock to 18%." },
  { id: "unemployment", label: "Labor contraction", note: "Remove one third of jobs." },
  { id: "shock", label: "Price shock", note: "Raise food prices and compress wages." },
  { id: "isolation", label: "Social isolation", note: "Reduce interaction opportunities." },
];

type WorkerMessage = { type: "snapshot"; snapshot: WorldSnapshot } | { type: "evaluation"; results: EvaluationResult[]; durationMs: number };

function Meter({ label, value, inverse = false }: { label: string; value: number; inverse?: boolean }) {
  const normalized = inverse ? 100 - value : value;
  return <div className="meter-row"><span>{label}</span><div className="meter"><i style={{ width: `${Math.max(2, normalized)}%` }} /></div><b>{Math.round(value)}</b></div>;
}

function AgentInspector({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  const qEntries = Object.entries(agent.trace.qValues).sort((a,b) => b[1] - a[1]);
  return <section className="inspector" aria-label={`Inspector for ${agent.name}`}>
    <header className="inspector-head"><div><span className="eyebrow">Citizen trace · {agent.id}</span><h2>{agent.name}</h2><p>{agent.profession} / {agent.profile}</p></div><button className="icon-button" onClick={onClose} aria-label="Close inspector"><X size={16}/></button></header>
    <div className="agent-status"><span className="pulse-dot" /><b>{ACTION_LABELS[agent.action]}</b><small>Reward {agent.trace.reward >= 0 ? "+" : ""}{agent.trace.reward.toFixed(2)}</small></div>
    <div className="needs-grid">
      <Meter label="Energy" value={agent.needs.energy}/><Meter label="Hunger" value={agent.needs.hunger} inverse/><Meter label="Social" value={agent.needs.social} inverse/><Meter label="Growth" value={agent.needs.growth} inverse/>
    </div>
    <div className="trace-block"><span className="eyebrow">Decision trace</span><dl>
      <div><dt>Observed state</dt><dd>{agent.trace.state}</dd></div>
      <div><dt>Valid actions</dt><dd>{agent.trace.validActions.join(" · ")}</dd></div>
      <div><dt>Choice mechanism</dt><dd>{agent.trace.reason}</dd></div>
      <div><dt>Policy ε</dt><dd>{agent.trace.epsilon.toFixed(3)}</dd></div>
    </dl></div>
    <div className="q-values"><div className="section-label"><span>Learned action values</span><span>Q(s,a)</span></div>{qEntries.map(([action,value]) => <div key={action} className={action === agent.action ? "is-chosen" : ""}><span>{action}</span><i style={{ width: `${Math.min(100, Math.abs(value) * 8 + 4)}%` }}/><b>{value.toFixed(3)}</b></div>)}</div>
    <div className="memory"><div className="section-label"><span>Recent experience</span><span>{agent.memory.length}/18</span></div>{agent.memory.slice(-4).reverse().map((item) => <p key={item.tick}><b>T{item.tick}</b><span>{item.action}</span><em>{item.reward >= 0 ? "+" : ""}{item.reward.toFixed(2)}</em></p>)}</div>
  </section>;
}

export function CityLab() {
  const workerRef = useRef<Worker | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [snapshot, setSnapshot] = useState<WorldSnapshot | null>(null);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [selectedId, setSelectedId] = useState<string>();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [panel, setPanel] = useState<"citizen" | "lab" | "data">("citizen");
  const [evaluation, setEvaluation] = useState<EvaluationResult[]>();
  const [evaluating, setEvaluating] = useState(false);
  const [quality, setQuality] = useState<"low"|"high">("high");
  const [notice, setNotice] = useState("Local engine ready");

  useEffect(() => {
    const qualityFrame = requestAnimationFrame(() => {
      setQuality((navigator.hardwareConcurrency || 4) <= 4 || window.innerWidth < 720 ? "low" : "high");
    });
    const worker = new Worker(new URL("../workers/simulation.worker.ts", import.meta.url));
    workerRef.current = worker;
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      if (event.data.type === "snapshot") setSnapshot(event.data.snapshot);
      if (event.data.type === "evaluation") { setEvaluation(event.data.results); setEvaluating(false); setNotice(`Evaluation completed in ${event.data.durationMs.toFixed(0)} ms`); }
    };
    worker.onerror = () => setNotice("Worker interrupted — reload to restart the local engine");
    return () => { cancelAnimationFrame(qualityFrame); worker.terminate(); };
  }, []);

  const send = useCallback((message: object) => workerRef.current?.postMessage(message), []);
  const selected = useMemo(() => snapshot?.agents.find((agent) => agent.id === selectedId), [snapshot, selectedId]);
  const selectAgent = (id: string) => { setSelectedId(id); setPanel("citizen"); setDrawerOpen(true); };
  const togglePlay = () => { const next = !playing; setPlaying(next); send({ type: next ? "play" : "pause" }); };
  const setSimulationSpeed = (value: number) => { setSpeed(value); send({ type: "speed", value }); };
  const setPolicy = (value: PolicyKind) => { send({ type: "policy", value }); setNotice(`Policy switched to ${value}`); };
  const runExperiment = (value: ExperimentKind) => { send({ type: "experiment", value }); setNotice(`${value} intervention recorded`); };
  const reset = () => { send({ type: "reset", seed: snapshot?.seed ?? 7319 }); setSelectedId(undefined); setNotice("City reset from deterministic seed"); };
  const save = () => {
    if (!snapshot) return;
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `synapse-city-${snapshot.seed}-t${snapshot.tick}.json`; anchor.click(); URL.revokeObjectURL(url);
  };
  const restore = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    try { const parsed = JSON.parse(await file.text()) as WorldSnapshot; if (parsed.schemaVersion !== 1) throw new Error(); send({ type: "restore", snapshot: parsed }); setNotice(`Snapshot restored · tick ${parsed.tick}`); }
    catch { setNotice("Snapshot rejected: incompatible or invalid data"); }
    event.target.value = "";
  };
  const saveLocal = () => {
    localStorage.setItem("synapse-city-snapshot", JSON.stringify(snapshot));
    setNotice("Checkpoint saved in this browser");
  };
  const restoreLocal = () => {
    try {
      const saved = localStorage.getItem("synapse-city-snapshot");
      if (!saved) { setNotice("No browser checkpoint found"); return; }
      const restored = JSON.parse(saved) as WorldSnapshot;
      if (restored.schemaVersion !== 1) throw new Error();
      send({ type: "restore", snapshot: restored });
      setNotice(`Browser checkpoint restored · tick ${restored.tick}`);
    } catch { setNotice("Browser checkpoint is incompatible"); }
  };
  const evaluate = () => { setEvaluating(true); setPanel("data"); setDrawerOpen(true); send({ type: "evaluate" }); setNotice("Running 12 headless evaluation episodes"); };

  if (!snapshot) return <main className="boot"><div className="boot-mark"><i/><i/><i/></div><p>SYNAPSE CITY</p><span>Starting deterministic local engine</span></main>;
  const metrics = snapshot.metrics;
  return <main className="lab-shell">
    <div className="city-stage">
      <CityScene snapshot={snapshot} selectedId={selectedId} onSelect={selectAgent} quality={quality}/>
      <div className="scanlines" aria-hidden="true" />
    </div>

    <header className="topbar">
      <div className="brand"><div className="brand-glyph"><i/><i/><i/></div><div><strong>SYNAPSE CITY</strong><span>Artificial society laboratory</span></div></div>
      <div className="top-status"><span className="live-badge"><i/> LOCAL LAB</span><span>SEED {snapshot.seed}</span><span>DAY {metrics.day} · {String(metrics.hour).padStart(2,"0")}:00</span><Link href="/technical">TECHNICAL BRIEF <BookOpen size={13}/></Link></div>
    </header>

    <aside className="metric-rail" aria-label="Live city metrics">
      <div><Users size={14}/><span>Population</span><strong>{metrics.population}</strong></div>
      <div><Activity size={14}/><span>Satisfaction</span><strong>{metrics.satisfaction.toFixed(1)}</strong></div>
      <div><Gauge size={14}/><span>Reward / tick</span><strong>{metrics.averageReward.toFixed(2)}</strong></div>
      <div><span className="metric-symbol">¤</span><span>Mean wealth</span><strong>{metrics.wealth.toFixed(0)}</strong></div>
    </aside>

    <div className="mode-note"><WifiOff size={13}/><span>Browser-resident engine</span><b>{notice}</b></div>

    <section className={`side-panel ${drawerOpen ? "is-open" : ""}`}>
      <button className="drawer-handle" onClick={() => setDrawerOpen((open) => !open)} aria-label="Toggle data panel"><span/><ChevronDown size={16}/></button>
      <nav className="panel-tabs" aria-label="Laboratory panels">
        <button className={panel === "citizen" ? "active" : ""} onClick={() => setPanel("citizen")}>Citizen</button>
        <button className={panel === "lab" ? "active" : ""} onClick={() => setPanel("lab")}>Experiments</button>
        <button className={panel === "data" ? "active" : ""} onClick={() => setPanel("data")}>Evidence</button>
      </nav>
      <div className="panel-scroll">
        {panel === "citizen" && (selected ? <AgentInspector agent={selected} onClose={() => setSelectedId(undefined)}/> : <div className="empty-panel"><div className="target-reticle"><i/><i/></div><span className="eyebrow">Explore a living city</span><h2>Select a citizen</h2><p>Tap any moving citizen to inspect the exact state, valid actions, utilities, learned Q-values and observed reward behind the latest decision.</p><button onClick={() => selectAgent(snapshot.agents[0].id)}>Inspect citizen 001</button></div>)}
        {panel === "lab" && <div className="lab-panel"><span className="eyebrow">Controlled interventions</span><h2>Disturb the system.</h2><p>Each scenario changes an explicit environmental variable. Outcomes come from subsequent simulation ticks.</p><div className="experiment-list">{EXPERIMENTS.map((experiment) => <button key={experiment.id} className={snapshot.experiment === experiment.id ? "active" : ""} onClick={() => runExperiment(experiment.id)}><FlaskConical size={16}/><span><b>{experiment.label}</b><small>{experiment.note}</small></span><i/></button>)}</div><button className="text-button" onClick={() => runExperiment("none")}>Restore control conditions</button><div className="checkpoint-actions"><button onClick={saveLocal}><Save size={14}/>Save checkpoint</button><button onClick={restoreLocal}><RotateCcw size={14}/>Load checkpoint</button></div><div className="event-log"><div className="section-label"><span>Audit log</span><span>{snapshot.events.length}</span></div>{snapshot.events.slice(0,6).map((event) => <p key={event.id}><b>T{event.tick}</b><span>{event.message}</span></p>)}</div></div>}
        {panel === "data" && <div className="data-panel"><span className="eyebrow">Inside the intelligence</span><h2>Measured, not narrated.</h2><p>Evaluation runs identical seeds for valid-random, heuristic and trainable policies in the same headless engine.</p><button className="primary-action" disabled={evaluating} onClick={evaluate}>{evaluating ? "Running 12 episodes…" : "Run policy evaluation"}</button>{evaluation && <div className="evaluation-table"><div><span>Policy</span><span>Satisfaction</span><span>Reward</span></div>{evaluation.map((row) => <div key={row.policy} className={row.policy === "q-learning" ? "learned" : ""}><b>{row.policy}</b><span>{row.satisfaction}</span><span>{row.averageReward}</span></div>)}</div>}<div className="chart-card"><div className="section-label"><span>Live satisfaction</span><span>{snapshot.history.length} samples</span></div><MetricChart data={snapshot.history}/></div><div className="method-note"><b>Evaluation protocol</b><p>4 held-out seeds × 420 ticks. Exploration is disabled for baselines and decays for Q-learning. No display data is randomized.</p></div></div>}
      </div>
    </section>

    <footer className="control-deck">
      <div className="transport"><button className="play" onClick={togglePlay} aria-label={playing ? "Pause simulation" : "Play simulation"}>{playing ? <CirclePause/> : <CirclePlay/>}</button><button onClick={() => send({type:"step"})} disabled={playing} aria-label="Advance one tick"><SkipForward/></button><button onClick={reset} aria-label="Reset city"><RotateCcw/></button></div>
      <div className="speed-control"><span>SIM RATE</span>{[1,2,5].map((value) => <button className={speed === value ? "active" : ""} key={value} onClick={() => setSimulationSpeed(value)}>{value}×</button>)}</div>
      <div className="tick-readout"><span>TICK</span><b>{snapshot.tick.toLocaleString()}</b><i style={{ width: `${snapshot.tick % 100}%` }}/></div>
      <label className="policy-select"><span>POLICY</span><select value={snapshot.policy} onChange={(event) => setPolicy(event.target.value as PolicyKind)}><option value="random">Valid random</option><option value="heuristic">Need heuristic</option><option value="q-learning">Q-learning</option></select></label>
      <div className="file-actions"><button onClick={save}><Download/> <span>Export</span></button><button onClick={() => fileRef.current?.click()}><Upload/> <span>Restore</span></button><input ref={fileRef} type="file" accept="application/json" onChange={restore}/><button onClick={saveLocal}><Save/> <span>Save</span></button></div>
      <button className="mobile-panel-button" onClick={() => setDrawerOpen(true)}>LAB DATA <ChevronDown/></button>
    </footer>
  </main>;
}
