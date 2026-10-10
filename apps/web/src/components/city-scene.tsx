"use client";

import { Environment, MapControls, OrthographicCamera } from "@react-three/drei";
import { Canvas, ThreeEvent, useFrame } from "@react-three/fiber";
import { Agent, WorldSnapshot } from "@synapse/simulation";
import { memo, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

type Props = { snapshot: WorldSnapshot; selectedId?: string; onSelect: (id: string) => void; quality: "low" | "high" };

const BUILDINGS = [
  [-7, -7, 3.2, 2.8, 2.8, "#385363"], [-3, -7, 2.7, 3.8, 2.7, "#405a67"], [2, -7, 3.6, 5.4, 3.2, "#344b58"], [7, -7, 3.8, 6.8, 3.2, "#2c4c5a"],
  [-7, -3, 3.1, 3.2, 2.8, "#675642"], [7, -3, 3.2, 4.5, 2.8, "#3d6570"], [-7, 3, 3.4, 4.1, 2.8, "#3a5964"], [7, 3, 3.4, 3.5, 2.8, "#66715e"],
  [-7, 7, 3.4, 5.8, 3.1, "#315160"], [-2.7, 7, 3.1, 3.4, 2.8, "#73594a"], [2.5, 7, 3.4, 4.5, 2.8, "#3c6170"], [7, 7, 3.2, 7.4, 3.1, "#5d554c"],
] as const;

function Buildings() {
  return <group>{BUILDINGS.map(([x, z, w, h, d, color], index) => (
    <group key={index} position={[x, 0, z]}>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} /><meshStandardMaterial color={color} roughness={0.82} />
      </mesh>
      <mesh position={[0, h + 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w * 0.82, d * 0.82]} /><meshStandardMaterial color={index % 3 === 0 ? "#d99a43" : "#77c8c9"} emissive={index % 3 === 0 ? "#6b3d10" : "#24595e"} emissiveIntensity={0.25} />
      </mesh>
      {Array.from({ length: Math.max(1, Math.floor(h / 1.4)) }, (_, floor) => (
        <mesh key={floor} position={[0, 1 + floor * 1.35, d / 2 + 0.006]}>
          <planeGeometry args={[w * 0.58, 0.22]} /><meshBasicMaterial color="#83d3d0" transparent opacity={0.58} />
        </mesh>
      ))}
    </group>
  ))}</group>;
}

function Ground() {
  const trees = useMemo(() => [[-9,0],[-9,5],[-4,2],[4,2],[9,0],[9,5],[-4,-10],[4,-10],[0,9]] as const, []);
  return <group>
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[28, 28]} /><meshStandardMaterial color="#173338" roughness={1} /></mesh>
    <gridHelper args={[28, 28, "#23515a", "#1d4046"]} position={[0, 0.012, 0]} />
    <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[3.2, 28]} /><meshStandardMaterial color="#182428" /></mesh>
    <mesh position={[0, 0.032, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} receiveShadow><planeGeometry args={[3.2, 28]} /><meshStandardMaterial color="#182428" /></mesh>
    <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[2.8, 32]} /><meshStandardMaterial color="#284e4d" /></mesh>
    {trees.map(([x,z], i) => <group key={i} position={[x,0,z]}>
      <mesh position={[0,.55,0]} castShadow><cylinderGeometry args={[.11,.16,1.1,6]} /><meshStandardMaterial color="#5f4735" /></mesh>
      <mesh position={[0,1.45,0]} castShadow><coneGeometry args={[.68,1.65,7]} /><meshStandardMaterial color={i%2 ? "#3c775f" : "#397066"} /></mesh>
    </group>)}
  </group>;
}

function Citizens({ agents, selectedId, onSelect }: { agents: Agent[]; selectedId?: string; onSelect: (id: string) => void }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const marker = useRef<THREE.Mesh>(null);
  const matrix = useMemo(() => new THREE.Matrix4(), []);
  const color = useMemo(() => new THREE.Color(), []);
  useEffect(() => {
    if (!mesh.current) return;
    agents.forEach((agent, index) => {
      matrix.makeTranslation(agent.position.x, 0.38, agent.position.z); mesh.current!.setMatrixAt(index, matrix);
      color.set(agent.id === selectedId ? "#ffd166" : agent.action === "work" ? "#54d7de" : agent.action === "eat" ? "#f19b55" : agent.action === "socialize" ? "#e6d27a" : "#9fc2c4");
      mesh.current!.setColorAt(index, color);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  }, [agents, selectedId, matrix, color]);
  useFrame(({ clock }) => { if (marker.current) marker.current.rotation.z = clock.elapsedTime * 0.8; });
  const selected = agents.find((agent) => agent.id === selectedId);
  const select = (event: ThreeEvent<MouseEvent>) => { event.stopPropagation(); if (event.instanceId !== undefined) onSelect(agents[event.instanceId].id); };
  return <>
    <instancedMesh ref={mesh} args={[undefined, undefined, agents.length]} onClick={select} castShadow>
      <capsuleGeometry args={[0.16, 0.35, 4, 8]} /><meshStandardMaterial roughness={0.55} />
    </instancedMesh>
    {selected && <mesh ref={marker} position={[selected.position.x, 0.04, selected.position.z]} rotation={[-Math.PI/2,0,0]}>
      <ringGeometry args={[0.36,0.48,24]} /><meshBasicMaterial color="#ffd166" transparent opacity={0.9} side={THREE.DoubleSide} />
    </mesh>}
  </>;
}

function Scene({ snapshot, selectedId, onSelect, quality }: Props) {
  const sun = (snapshot.metrics.hour / 24) * Math.PI * 2;
  const daylight = Math.max(0.18, Math.sin(sun - Math.PI / 2) * 0.55 + 0.55);
  return <>
    <color attach="background" args={[daylight < .3 ? "#07151c" : "#102b32"]} />
    <fog attach="fog" args={[daylight < .3 ? "#07151c" : "#102b32", 18, 42]} />
    <ambientLight intensity={0.45 + daylight * 0.7} color="#bfe3dc" />
    <directionalLight position={[8, 15, 6]} intensity={0.6 + daylight * 1.8} color={daylight < .35 ? "#6ba9c8" : "#ffe2a8"} castShadow={quality === "high"} shadow-mapSize={[1024,1024]} />
    <Ground /><Buildings /><Citizens agents={snapshot.agents} selectedId={selectedId} onSelect={onSelect} />
    <OrthographicCamera makeDefault position={[18, 19, 18]} zoom={quality === "low" ? 36 : 44} />
    <MapControls makeDefault enableDamping dampingFactor={0.08} minZoom={25} maxZoom={76} maxPolarAngle={Math.PI / 2.15} screenSpacePanning touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }} />
    {quality === "high" && <Environment preset="city" environmentIntensity={0.22} />}
  </>;
}

export const CityScene = memo(function CityScene(props: Props) {
  return <Canvas shadows={props.quality === "high"} dpr={props.quality === "high" ? [1,1.6] : 1} gl={{ antialias: props.quality === "high", powerPreference: "high-performance" }}>
    <Scene {...props} />
  </Canvas>;
});
