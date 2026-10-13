"use client";

import { Environment, Html, Line, MapControls, OrthographicCamera, Sparkles, Stars } from "@react-three/drei";
import { Canvas, ThreeEvent, useFrame } from "@react-three/fiber";
import { Action, Agent, WorldSnapshot } from "@synapse/simulation";
import { memo, useMemo, useRef } from "react";
import * as THREE from "three";

type Props = { snapshot: WorldSnapshot; selectedId?: string; onSelect: (id: string) => void; quality: "low" | "high" };
type Building = { x: number; z: number; w: number; h: number; d: number; color: string; accent: string; kind: "tower" | "block" | "market" | "campus" };

const BUILDINGS: Building[] = [
  { x:-15,z:-14,w:4.6,h:5.2,d:4.2,color:"#1c414c",accent:"#6fd9dc",kind:"block" },
  { x:-9,z:-14,w:4.2,h:8.4,d:4,color:"#234b55",accent:"#80e0d7",kind:"tower" },
  { x:-3,z:-14,w:4,h:4.8,d:4,color:"#31505a",accent:"#f2b85f",kind:"block" },
  { x:4,z:-14,w:5,h:9.6,d:4.3,color:"#173f4b",accent:"#72d4df",kind:"tower" },
  { x:11,z:-14,w:5.2,h:6.4,d:4.1,color:"#294853",accent:"#c4e7dc",kind:"block" },
  { x:17,z:-13,w:3.2,h:11.4,d:3.2,color:"#1b4651",accent:"#f2b85f",kind:"tower" },
  { x:-15,z:-7,w:4.8,h:4,d:3.8,color:"#5b4938",accent:"#ffb457",kind:"market" },
  { x:-8,z:-7,w:4,h:6.2,d:3.8,color:"#244750",accent:"#6fd9dc",kind:"block" },
  { x:9,z:-7,w:4.6,h:7.8,d:4,color:"#234c59",accent:"#74d6dc",kind:"tower" },
  { x:16,z:-6,w:4.5,h:5,d:4,color:"#4b5147",accent:"#a6d477",kind:"block" },
  { x:-16,z:2,w:4.2,h:8.8,d:4.2,color:"#214753",accent:"#77ced8",kind:"tower" },
  { x:-9,z:2,w:4.8,h:5.6,d:4,color:"#3a5155",accent:"#f2b85f",kind:"block" },
  { x:9,z:2,w:4.5,h:4.4,d:4.5,color:"#3f554d",accent:"#9bd17e",kind:"campus" },
  { x:16,z:2,w:4,h:7.2,d:4,color:"#234b55",accent:"#75d8dd",kind:"tower" },
  { x:-15,z:10,w:5,h:5.4,d:4.4,color:"#294b54",accent:"#6fd9dc",kind:"block" },
  { x:-8,z:10,w:4,h:9.2,d:4,color:"#1d414b",accent:"#f2b85f",kind:"tower" },
  { x:8,z:10,w:5.4,h:4,d:4.8,color:"#40594f",accent:"#9fd680",kind:"campus" },
  { x:16,z:10,w:4.2,h:6.8,d:4,color:"#284953",accent:"#75d8dd",kind:"block" },
  { x:-15,z:17,w:4.8,h:7.2,d:4,color:"#244650",accent:"#72d4df",kind:"tower" },
  { x:-8,z:17,w:4.2,h:4.4,d:4,color:"#57493d",accent:"#f2b85f",kind:"market" },
  { x:2,z:17,w:5,h:6,d:4,color:"#294b54",accent:"#73d3d9",kind:"block" },
  { x:10,z:17,w:4.2,h:8,d:4,color:"#1e424d",accent:"#8fe3df",kind:"tower" },
  { x:17,z:17,w:3.5,h:12.5,d:3.5,color:"#173e49",accent:"#f2b85f",kind:"tower" },
];

const PROFILE_COLORS: Record<string, string> = {
  Disciplined:"#55d8df", Social:"#f0c45d", Curious:"#a8dd7f", Cautious:"#78a9e6",
  Economic:"#df9a57", Student:"#b598e8", Merchant:"#e78370", Explorer:"#72d6b3",
};
const ACTION_COLORS: Record<Action, string> = { work:"#5ee2e5", eat:"#ffad5d", rest:"#8aa7e8", study:"#bd9df2", socialize:"#f2d36f", explore:"#75dbb5" };
const SKIN_TONES = ["#f2c6a0","#dca47d","#b97b5c","#84533f","#e3b58f","#6e4537"];

function BuildingModel({ building, index, daylight }: { building: Building; index: number; daylight: number }) {
  const floors = Math.max(2, Math.floor(building.h / 1.25));
  const windowGlow = daylight < .35 ? 1.7 : .35;
  return <group position={[building.x,0,building.z]}>
    <mesh position={[0,building.h/2,0]} castShadow receiveShadow><boxGeometry args={[building.w,building.h,building.d]}/><meshStandardMaterial color={building.color} roughness={.72} metalness={building.kind === "tower"?.18:.05}/></mesh>
    <mesh position={[0,building.h+.11,0]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[building.w*.84,building.d*.84]}/><meshStandardMaterial color={building.accent} emissive={building.accent} emissiveIntensity={.18}/></mesh>
    {Array.from({length:floors},(_,floor)=><group key={floor} position={[0,.82+floor*1.18,0]}>
      <mesh position={[0,0,building.d/2+.008]}><planeGeometry args={[building.w*.62,.16]}/><meshStandardMaterial color={building.accent} emissive={building.accent} emissiveIntensity={windowGlow} transparent opacity={.72}/></mesh>
      <mesh position={[building.w/2+.008,0,0]} rotation={[0,Math.PI/2,0]}><planeGeometry args={[building.d*.58,.13]}/><meshStandardMaterial color={building.accent} emissive={building.accent} emissiveIntensity={windowGlow*.7} transparent opacity={.52}/></mesh>
    </group>)}
    {building.kind === "tower" && <><mesh position={[0,building.h+.48,0]} castShadow><cylinderGeometry args={[.11,.18,.75,8]}/><meshStandardMaterial color="#88cbd0" metalness={.8}/></mesh><pointLight position={[0,building.h+.9,0]} color={index%2?"#67e0e4":"#f0b45e"} intensity={daylight<.35?1.6:0} distance={5}/></>}
    {building.kind === "market" && <mesh position={[0,.7,building.d/2+.38]} rotation={[.25,0,0]} castShadow><boxGeometry args={[building.w*.82,.12,.85]}/><meshStandardMaterial color="#d89447"/></mesh>}
    {building.kind === "campus" && <mesh position={[0,building.h+.45,0]} rotation={[0,0,.18]}><boxGeometry args={[building.w*.48,.06,building.d*.48]}/><meshStandardMaterial color="#315f63" metalness={.25}/></mesh>}
  </group>;
}

function RoadsAndGround() {
  const trees = useMemo(() => [[-19,-18],[-13,-18],[-5,-18],[7,-18],[14,-18],[20,-10],[-20,-4],[-12,-1],[-5,7],[5,7],[12,6],[20,7],[-19,14],[-12,14],[-3,14],[5,14],[14,14],[20,20]] as const, []);
  const roadLines = [-11,-3,5,13];
  return <group>
    <mesh rotation={[-Math.PI/2,0,0]} receiveShadow><planeGeometry args={[46,46]}/><meshStandardMaterial color="#102b2f" roughness={1}/></mesh>
    <gridHelper args={[46,46,"#1d5055","#173b40"]} position={[0,.012,0]}/>
    <mesh position={[0,.025,0]} rotation={[-Math.PI/2,0,0]} receiveShadow><planeGeometry args={[5.1,46]}/><meshStandardMaterial color="#101e22" roughness={.96}/></mesh>
    <mesh position={[0,.027,0]} rotation={[-Math.PI/2,0,Math.PI/2]} receiveShadow><planeGeometry args={[5.1,46]}/><meshStandardMaterial color="#101e22" roughness={.96}/></mesh>
    {roadLines.map((offset)=><group key={offset}><mesh position={[offset,.026,0]} rotation={[-Math.PI/2,0,0]} receiveShadow><planeGeometry args={[1.15,46]}/><meshStandardMaterial color="#17262a"/></mesh><mesh position={[0,.028,offset]} rotation={[-Math.PI/2,0,Math.PI/2]} receiveShadow><planeGeometry args={[1.15,46]}/><meshStandardMaterial color="#17262a"/></mesh></group>)}
    {Array.from({length:12},(_,i)=><group key={i}><mesh position={[0,.045,-20+i*3.6]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[.08,1.25]}/><meshBasicMaterial color="#588087"/></mesh><mesh position={[-20+i*3.6,.047,0]} rotation={[-Math.PI/2,0,Math.PI/2]}><planeGeometry args={[.08,1.25]}/><meshBasicMaterial color="#588087"/></mesh></group>)}
    <mesh position={[0,.055,0]} rotation={[-Math.PI/2,0,0]} receiveShadow><circleGeometry args={[3.25,48]}/><meshStandardMaterial color="#285052"/></mesh>
    <mesh position={[0,.09,0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[2.25,2.34,48]}/><meshBasicMaterial color="#65cbd0" transparent opacity={.5}/></mesh>
    <mesh position={[0,.7,0]} castShadow><cylinderGeometry args={[.56,.86,1.4,8]}/><meshStandardMaterial color="#315f63"/></mesh>
    <mesh position={[0,2.15,0]} castShadow><octahedronGeometry args={[.92,0]}/><meshStandardMaterial color="#66dbe0" emissive="#2c8c91" emissiveIntensity={.9} wireframe/></mesh><pointLight position={[0,2.2,0]} color="#68e6e8" intensity={1.2} distance={7}/>
    <mesh position={[-15,.04,5]} rotation={[-Math.PI/2,0,0]} receiveShadow><circleGeometry args={[3.2,32]}/><meshStandardMaterial color="#234c40"/></mesh><mesh position={[15,.04,-1]} rotation={[-Math.PI/2,0,0]} receiveShadow><circleGeometry args={[2.7,32]}/><meshStandardMaterial color="#254d43"/></mesh>
    {trees.map(([x,z],i)=><group key={i} position={[x,0,z]}><mesh position={[0,.48,0]} castShadow><cylinderGeometry args={[.1,.15,.96,7]}/><meshStandardMaterial color="#614735"/></mesh><mesh position={[0,1.25,0]} castShadow><dodecahedronGeometry args={[.62,0]}/><meshStandardMaterial color={i%3===0?"#3d8068":"#326c5a"}/></mesh></group>)}
  </group>;
}

function ProfessionAccessory({ profession, accent }: { profession: string; accent: string }) {
  if (profession === "Builder") return <mesh position={[0,.99,0]}><sphereGeometry args={[.19,10,6,0,Math.PI*2,0,Math.PI/2]}/><meshStandardMaterial color="#f2b85f"/></mesh>;
  if (profession === "Cook") return <group position={[0,1.03,0]}><mesh><cylinderGeometry args={[.15,.18,.13,10]}/><meshStandardMaterial color="#e6e1d1"/></mesh><mesh position={[0,.11,0]}><sphereGeometry args={[.14,10,6]}/><meshStandardMaterial color="#f5f0df"/></mesh></group>;
  if (profession === "Engineer") return <mesh position={[0,.79,.18]}><boxGeometry args={[.28,.08,.05]}/><meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={.5}/></mesh>;
  if (profession === "Nurse") return <group position={[0,.57,.18]}><mesh><boxGeometry args={[.2,.055,.025]}/><meshBasicMaterial color="#f0d9d2"/></mesh><mesh><boxGeometry args={[.055,.2,.026]}/><meshBasicMaterial color="#f0d9d2"/></mesh></group>;
  if (profession === "Teacher" || profession === "Analyst") return <mesh position={[.23,.5,.13]} rotation={[0,-.25,.08]}><boxGeometry args={[.08,.3,.22]}/><meshStandardMaterial color={accent}/></mesh>;
  return <mesh position={[0,.5,-.17]}><boxGeometry args={[.26,.3,.09]}/><meshStandardMaterial color="#35545a"/></mesh>;
}

function Citizen({ agent, selected, onSelect }: { agent: Agent; selected: boolean; onSelect:(id:string)=>void }) {
  const group = useRef<THREE.Group>(null); const halo = useRef<THREE.Mesh>(null);
  const idNumber = Number(agent.id.split("-").at(-1)) || 0;
  const identity = useMemo(()=>({body:PROFILE_COLORS[agent.profile]??"#83c7ca",skin:SKIN_TONES[idNumber%SKIN_TONES.length],accent:ACTION_COLORS[agent.action],scale:.9+(idNumber%7)*.025}),[agent.profile,agent.action,idNumber]);
  useFrame(({clock},delta)=>{ if(!group.current)return; const target=new THREE.Vector3(agent.position.x,0,agent.position.z); group.current.position.lerp(target,1-Math.exp(-delta*9)); group.current.position.y=Math.sin(clock.elapsedTime*4.2+idNumber)*.025; const dx=agent.target.x-group.current.position.x; const dz=agent.target.z-group.current.position.z; if(Math.abs(dx)+Math.abs(dz)>.08)group.current.rotation.y=Math.atan2(dx,dz); if(halo.current)halo.current.rotation.z+=delta*.8; });
  const click=(event:ThreeEvent<MouseEvent>)=>{event.stopPropagation();if(event.delta<=3)onSelect(agent.id)};
  return <group ref={group} position={[agent.position.x,0,agent.position.z]} scale={identity.scale} onClick={click} onPointerOver={(event)=>{event.stopPropagation();document.body.style.cursor="pointer"}} onPointerOut={()=>{document.body.style.cursor="default"}}>
    <mesh position={[0,.5,0]} castShadow><capsuleGeometry args={[.15,.34,5,9]}/><meshStandardMaterial color={identity.body} roughness={.62}/></mesh><mesh position={[0,.88,0]} castShadow><sphereGeometry args={[.17,12,10]}/><meshStandardMaterial color={identity.skin} roughness={.8}/></mesh><mesh position={[0,.93,.14]}><boxGeometry args={[.2,.045,.035]}/><meshStandardMaterial color="#173039"/></mesh>
    <mesh position={[-.12,.29,0]} rotation={[0,0,-.08]} castShadow><capsuleGeometry args={[.045,.22,3,6]}/><meshStandardMaterial color={identity.body}/></mesh><mesh position={[.12,.29,0]} rotation={[0,0,.08]} castShadow><capsuleGeometry args={[.045,.22,3,6]}/><meshStandardMaterial color={identity.body}/></mesh>
    <ProfessionAccessory profession={agent.profession} accent={identity.accent}/><mesh position={[0,1.18,0]}><octahedronGeometry args={[.07,0]}/><meshBasicMaterial color={identity.accent}/></mesh>
    {selected && <><mesh ref={halo} position={[0,.035,0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[.38,.5,28]}/><meshBasicMaterial color="#ffd166" transparent opacity={.92} side={THREE.DoubleSide}/></mesh><pointLight position={[0,1.15,0]} color={identity.accent} intensity={.9} distance={2.7}/><Html position={[0,1.48,0]} center distanceFactor={13} zIndexRange={[30,0]}><button className="citizen-world-label" onClick={()=>onSelect(agent.id)}><b>{agent.name}</b><span>{agent.profession} · {agent.action}</span></button></Html></>}
  </group>;
}

function Citizens({ agents, selectedId, onSelect, quality }: { agents: Agent[]; selectedId?: string; onSelect:(id:string)=>void; quality:"low"|"high" }) {
  const selected=agents.find((agent)=>agent.id===selectedId); const route=selected?[[selected.position.x,.07,selected.position.z],...selected.path.map((point)=>[point.x,.07,point.z])] as [number,number,number][]:[];
  return <>{quality==="high"&&route.length>1&&<Line points={route} color={ACTION_COLORS[selected!.action]} lineWidth={1.2} transparent opacity={.52} dashed dashSize={.22} gapSize={.12}/>} {agents.map((agent)=><Citizen key={agent.id} agent={agent} selected={agent.id===selectedId} onSelect={onSelect}/>)}</>;
}

function DistrictLabels(){return <>{[["MAKER WARD",-15,-21],["CIVIC CORE",0,-21],["MARKET ROW",15,-21],["COMMONS",-15,21],["LEARNING DISTRICT",8,21],["SKYLINE",17,21]].map(([label,x,z])=><Html key={label as string} position={[x as number,.08,z as number]} rotation={[-Math.PI/2,0,0]} center transform distanceFactor={18}><span className="district-label">{label}</span></Html>)}</>}

function Scene({ snapshot, selectedId, onSelect, quality }: Props) {
  const sun=(snapshot.metrics.hour/24)*Math.PI*2; const daylight=Math.max(.12,Math.sin(sun-Math.PI/2)*.55+.55);
  return <><color attach="background" args={[daylight<.3?"#071c24":"#0b2830"]}/><fog attach="fog" args={[daylight<.3?"#091e26":"#0b2830",30,70]}/><ambientLight intensity={.62+daylight*.58} color="#c2e9e1"/><hemisphereLight args={["#a9e0df","#173337",.62+daylight*.32]}/><directionalLight position={[15,24,9]} intensity={.9+daylight*1.45} color={daylight<.35?"#80b8d3":"#ffe0a1"} castShadow={quality==="high"} shadow-mapSize={[1024,1024]} shadow-camera-left={-25} shadow-camera-right={25} shadow-camera-top={25} shadow-camera-bottom={-25}/>
    <RoadsAndGround/><group>{BUILDINGS.map((building,index)=><BuildingModel key={`${building.x}-${building.z}`} building={building} index={index} daylight={daylight}/>)}</group><Citizens agents={snapshot.agents} selectedId={selectedId} onSelect={onSelect} quality={quality}/>{quality==="high"&&<DistrictLabels/>}{quality==="high"&&daylight<.4&&<><Stars radius={60} depth={25} count={600} factor={2} fade speed={.15}/><Sparkles count={45} scale={[42,8,42]} size={1.2} speed={.12} opacity={.25} color="#78dce1"/></>}
    <OrthographicCamera makeDefault position={[31,32,31]} zoom={quality==="low"?27:31}/><MapControls makeDefault enableDamping dampingFactor={.07} enablePan={false} minZoom={18} maxZoom={72} maxPolarAngle={Math.PI/2.12} minPolarAngle={.45} mouseButtons={{LEFT:THREE.MOUSE.ROTATE,MIDDLE:THREE.MOUSE.DOLLY,RIGHT:THREE.MOUSE.ROTATE}} touches={{ONE:THREE.TOUCH.ROTATE,TWO:THREE.TOUCH.DOLLY_ROTATE}}/>{quality==="high"&&<Environment preset="city" environmentIntensity={.18}/>}</>;
}

export const CityScene=memo(function CityScene(props:Props){return <Canvas shadows={props.quality==="high"} dpr={props.quality==="high"?[1,1.5]:1} gl={{antialias:props.quality==="high",powerPreference:"high-performance",alpha:false}} camera={{near:.1,far:160}}><Scene {...props}/></Canvas>});
