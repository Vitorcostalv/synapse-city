"use client";

import dynamic from "next/dynamic";
import type { Action, Agent, WorldSnapshot } from "@synapse/simulation";
import type { CinematicShot } from "./city-scene";
import { CSSProperties, useEffect, useMemo, useState } from "react";

const CityScene = dynamic(() => import("./city-scene").then((module) => module.CityScene), { ssr: false });

const ACTION_LABELS: Record<Action, string> = { work: "Trabalhar", eat: "Comer", rest: "Descansar", study: "Estudar", socialize: "Socializar", explore: "Explorar" };
const SHOTS: CinematicShot[] = ["opening", "world-a", "world-b", "decision", "learning", "benchmark", "closing"];
const BENCHMARKS = [
  { label: "Aleatória", value: .395, tone: "muted" },
  { label: "Q-learning", value: .470, tone: "learned" },
  { label: "Heurística", value: .485, tone: "best" },
] as const;

type WorkerMessage = { type: "snapshot"; snapshot: WorldSnapshot };

declare global {
  interface Window {
    __SYNAPSE_CAPTURE_READY__?: boolean;
    __SYNAPSE_CAPTURE_START__?: () => void;
  }
}

function Need({ label, value, inverse = false }: { label: string; value: number; inverse?: boolean }) {
  const score = inverse ? 100 - value : value;
  return <div className="capture-need"><span>{label}</span><i><b style={{ width: `${Math.max(2, score)}%` }}/></i><strong>{Math.round(value)}</strong></div>;
}

function DecisionCard({ agent }: { agent: Agent }) {
  const qValues = Object.entries(agent.trace.qValues).sort((a,b) => b[1] - a[1]).slice(0,4);
  const peak = Math.max(.01, ...qValues.map(([,value]) => Math.abs(value)));
  return <section className="capture-decision-card">
    <header><div><span>RASTRO DE DECISÃO · {agent.id}</span><h2>{agent.name}</h2></div><aside><small>AÇÃO ESCOLHIDA</small><b>{ACTION_LABELS[agent.trace.chosen]}</b></aside></header>
    <div className="capture-needs">
      <Need label="ENERGIA" value={agent.needs.energy}/><Need label="FOME" value={agent.needs.hunger} inverse/>
      <Need label="SOCIAL" value={agent.needs.social} inverse/><Need label="CRESCIMENTO" value={agent.needs.growth} inverse/>
    </div>
    <div className="capture-q"><div className="capture-section-title"><span>VALORES APRENDIDOS</span><span>Q(s,a)</span></div>{qValues.map(([action,value]) => <div key={action} className={action === agent.trace.chosen ? "chosen" : ""}><span>{ACTION_LABELS[action as Action]}</span><i><b style={{ width: `${Math.max(3, Math.abs(value) / peak * 100)}%` }}/></i><strong>{value.toFixed(3)}</strong></div>)}</div>
    <footer><span>RECOMPENSA</span><strong>{agent.trace.reward >= 0 ? "+" : ""}{agent.trace.reward.toFixed(3)}</strong><small>{agent.trace.reason}</small></footer>
  </section>;
}

function LearningTrace({ agent }: { agent: Agent }) {
  const latest = agent.memory.slice(-3).reverse();
  return <section className="capture-learning-card">
    <div className="learning-signal"><span>ESTADO OBSERVADO</span><strong>{agent.trace.state}</strong></div>
    <div className="learning-arrow">→</div>
    <div className="learning-signal active"><span>AÇÃO</span><strong>{ACTION_LABELS[agent.trace.chosen]}</strong></div>
    <div className="learning-arrow">→</div>
    <div className="learning-signal reward"><span>RECOMPENSA</span><strong>{agent.trace.reward >= 0 ? "+" : ""}{agent.trace.reward.toFixed(3)}</strong></div>
    <div className="learning-history">{latest.map((item) => <p key={item.tick}><b>T{item.tick}</b><span>{ACTION_LABELS[item.action]}</span><em>{item.reward >= 0 ? "+" : ""}{item.reward.toFixed(2)}</em></p>)}</div>
  </section>;
}

function Benchmark() {
  return <section className="capture-benchmark">
    <header><span>AVALIAÇÃO · 4 SEEDS × 420 TICKS</span><h2>O aprendizado funcionou.<br/><em>Mas não foi o melhor.</em></h2></header>
    <div className="benchmark-axis"><span>0</span><span>RECOMPENSA MÉDIA</span><span>0,5</span></div>
    <div className="benchmark-bars">{BENCHMARKS.map((row) => <div className={`benchmark-row ${row.tone}`} key={row.label} style={{ "--bar-width": `${row.value / .5 * 100}%` } as CSSProperties}><span>{row.label}</span><i><b/></i><strong>{row.value.toFixed(3).replace(".",",")}</strong></div>)}</div>
    <div className="benchmark-reveal"><span>SUPEROU O ALEATÓRIO</span><b>+</b><strong>não venceu a heurística</strong></div>
  </section>;
}

function StoryOverlay({ shot, snapshot, agent }: { shot: CinematicShot; snapshot: WorldSnapshot; agent: Agent }) {
  return <>
    <div className="capture-topline"><span>SYNAPSE CITY / LAB 01</span><span>SEED {snapshot.seed} · T{snapshot.tick}</span></div>
    {shot === "opening" && <div className="capture-copy opening-copy"><span>UM EXPERIMENTO REAL</span><h1>Minha IA<br/><em>aprendeu.</em></h1><p>E mesmo assim perdeu.</p></div>}
    {shot === "world-a" && <div className="capture-copy world-copy"><strong>48</strong><h1>agentes<br/>autônomos.</h1><p>Um mundo compartilhado. Decisões individuais.</p></div>}
    {shot === "world-b" && <div className="capture-copy world-copy alternate"><span>CADA CIDADÃO</span><h1>tem suas próprias<br/><em>necessidades.</em></h1><div className="live-metric"><i/> SIMULAÇÃO EM EXECUÇÃO · {snapshot.metrics.interactions} INTERAÇÕES</div></div>}
    {shot === "decision" && <><div className="capture-copy decision-copy"><span>POR DENTRO DA POLÍTICA</span><h1>Cada decisão<br/>deixa um <em>rastro.</em></h1></div><DecisionCard agent={agent}/></>}
    {shot === "learning" && <><div className="capture-copy learning-copy"><h1>Estado. Ação.<br/><em>Recompensa. Aprendizado.</em></h1></div><LearningTrace agent={agent}/></>}
    {shot === "benchmark" && <Benchmark/>}
    {shot === "closing" && <div className="capture-closing"><span>UM LABORATÓRIO DE IA EM MOVIMENTO</span><h1>SYNAPSE<br/><em>CITY</em></h1><p>Laboratório de agentes autônomos</p><small>synapse-city-taupe.vercel.app</small></div>}
  </>;
}

export function CinematicCapture() {
  const [snapshot, setSnapshot] = useState<WorldSnapshot>();
  const [recording, setRecording] = useState(false);
  const take = 0;
  const [shot] = useState<CinematicShot>(() => {
    if (typeof window === "undefined") return "opening";
    const requested = new URLSearchParams(window.location.search).get("shot") as CinematicShot | null;
    return requested && SHOTS.includes(requested) ? requested : "opening";
  });
  const [selectedId, setSelectedId] = useState<string>();

  useEffect(() => {
    const worker = new Worker(new URL("../workers/simulation.worker.ts", import.meta.url));
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      if (event.data.type !== "snapshot") return;
      setSnapshot(event.data.snapshot);
      setSelectedId((current) => current ?? [...event.data.snapshot.agents].sort((a,b) => b.needs.hunger - a.needs.hunger)[0]?.id);
    };
    worker.postMessage({ type: "speed", value: 5 });
    return () => worker.terminate();
  }, []);

  useEffect(() => {
    if (!snapshot) return;
    window.__SYNAPSE_CAPTURE_READY__ = true;
    window.__SYNAPSE_CAPTURE_START__ = () => { setRecording(true); };
    return () => { delete window.__SYNAPSE_CAPTURE_READY__; delete window.__SYNAPSE_CAPTURE_START__; };
  }, [snapshot]);

  const selected = useMemo(() => snapshot?.agents.find((agent) => agent.id === selectedId) ?? snapshot?.agents[0], [snapshot, selectedId]);
  if (!snapshot || !selected) return <main className="capture-boot">CONSTRUINDO MODELO URBANO</main>;
  return <main className={`capture-shell capture-${shot} ${recording ? "is-recording" : ""}`}>
    <div className="capture-city"><CityScene snapshot={snapshot} selectedId={shot === "decision" || shot === "learning" ? selected.id : undefined} onSelect={setSelectedId} quality="high" cinematic={{ shot, take }}/></div>
    <div className="capture-grade"/><div className="capture-scan"/>
    <StoryOverlay shot={shot} snapshot={snapshot} agent={selected}/>
  </main>;
}

