# Architecture

SYNAPSE CITY treats the simulation as a domain library, not as a React feature. `packages/simulation` has no dependency on the browser, React, Three.js, or wall-clock time.

```mermaid
flowchart LR
  UI[Next.js laboratory UI] -->|typed commands| W[Web Worker]
  W -->|immutable snapshots| UI
  W --> E[TypeScript simulation core]
  E --> R[Seeded PRNG]
  E --> Q[Utility + tabular Q-learning]
  E --> C[Economy and social graph]
  UI --> T[React Three Fiber renderer]
  T -. reads only .-> UI
  API[FastAPI session gateway] -. optional health/session channel .-> UI
```

## Tick lifecycle

```mermaid
flowchart TD
  A[Advance simulated clock] --> B[Evolve needs]
  B --> C[Observe discretized state]
  C --> D[Filter invalid actions]
  D --> E[Epsilon-greedy decision]
  E --> F[A-star waypoint movement]
  F --> G[Execute economic/social action]
  G --> H[Calculate observable reward]
  H --> I[Update Q value]
  I --> J[Emit metrics, trace and snapshot]
```

## Trade-offs

- Browser-first execution keeps the public demo available during backend cold starts.
- A small tabular learner is explainable and testable; deep RL would add cost without demonstrated value for this state space.
- The FastAPI service is intentionally a session gateway today. It does not pretend to run a second, divergent Python simulation.
- JSON snapshots are schema-versioned and validated before restoration. Cloud persistence is not advertised.
