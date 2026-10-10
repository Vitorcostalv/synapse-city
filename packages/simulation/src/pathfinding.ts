import { Vec2 } from "./types";

const key = (point: Vec2) => `${point.x},${point.z}`;
const heuristic = (a: Vec2, b: Vec2) => Math.abs(a.x - b.x) + Math.abs(a.z - b.z);

export function findPath(startInput: Vec2, goalInput: Vec2, blocked: ReadonlySet<string>, limit = 12): Vec2[] {
  const start = { x: Math.round(startInput.x), z: Math.round(startInput.z) };
  const goal = { x: Math.round(goalInput.x), z: Math.round(goalInput.z) };
  const open = new Map<string, { point: Vec2; f: number }>([[key(start), { point: start, f: heuristic(start, goal) }]]);
  const cameFrom = new Map<string, string>();
  const points = new Map<string, Vec2>([[key(start), start]]);
  const cost = new Map<string, number>([[key(start), 0]]);

  while (open.size) {
    const currentEntry = [...open.entries()].sort((a, b) => a[1].f - b[1].f || a[0].localeCompare(b[0]))[0];
    const [currentKey, current] = currentEntry;
    open.delete(currentKey);
    if (currentKey === key(goal)) {
      const path: Vec2[] = [];
      let cursor = currentKey;
      while (cursor !== key(start)) { path.unshift(points.get(cursor)!); cursor = cameFrom.get(cursor)!; }
      return path;
    }
    for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const next = { x: current.point.x + dx, z: current.point.z + dz };
      const nextKey = key(next);
      if (Math.abs(next.x) > limit || Math.abs(next.z) > limit || (blocked.has(nextKey) && nextKey !== key(goal))) continue;
      const nextCost = (cost.get(currentKey) ?? 0) + 1;
      if (nextCost >= (cost.get(nextKey) ?? Infinity)) continue;
      cost.set(nextKey, nextCost); cameFrom.set(nextKey, currentKey); points.set(nextKey, next);
      open.set(nextKey, { point: next, f: nextCost + heuristic(next, goal) });
    }
  }
  return [];
}

export function cityBlockedCells(): Set<string> {
  const blocked = new Set<string>();
  const centers = [[-7,-7],[-3,-7],[2,-7],[7,-7],[-7,-3],[7,-3],[-7,3],[7,3],[-7,7],[-3,7],[3,7],[7,7]];
  for (const [cx, cz] of centers) for (let x = cx - 1; x <= cx + 1; x++) for (let z = cz - 1; z <= cz + 1; z++) blocked.add(`${x},${z}`);
  return blocked;
}
