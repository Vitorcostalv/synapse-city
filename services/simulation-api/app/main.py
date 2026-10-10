from __future__ import annotations

import asyncio
import os
import time
import uuid
from collections import defaultdict, deque
from dataclasses import dataclass

from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

APP_VERSION = "0.1.0"
MAX_SESSIONS = int(os.getenv("MAX_SESSIONS", "24"))
SESSION_TTL_SECONDS = 1800
ALLOWED_ORIGINS = [origin.strip() for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",") if origin.strip()]

app = FastAPI(title="Synapse City Session Gateway", version=APP_VERSION, docs_url="/docs")
app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS, allow_credentials=False, allow_methods=["GET", "POST"], allow_headers=["Content-Type"])


class SessionRequest(BaseModel):
    seed: int = Field(default=7319, ge=1, le=2_147_483_647)
    population: int = Field(default=48, ge=1, le=200)


@dataclass
class Session:
    id: str
    seed: int
    population: int
    created_at: float


sessions: dict[str, Session] = {}
request_windows: dict[str, deque[float]] = defaultdict(deque)


@app.middleware("http")
async def rate_limit(request: Request, call_next):
    address = request.client.host if request.client else "unknown"
    now = time.monotonic()
    window = request_windows[address]
    while window and window[0] < now - 60:
        window.popleft()
    if len(window) >= 120:
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    window.append(now)
    return await call_next(request)


def prune_sessions() -> None:
    cutoff = time.time() - SESSION_TTL_SECONDS
    for session_id in [key for key, value in sessions.items() if value.created_at < cutoff]:
        sessions.pop(session_id, None)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "synapse-city-gateway", "version": APP_VERSION}


@app.get("/ready")
def ready() -> dict[str, object]:
    prune_sessions()
    return {"ready": True, "activeSessions": len(sessions), "capacity": MAX_SESSIONS}


@app.get("/simulation")
def simulation_info() -> dict[str, object]:
    return {
        "canonicalRuntime": "browser-worker",
        "liveLabAvailable": False,
        "message": "The deterministic TypeScript engine runs locally. This gateway provides isolated session negotiation and health telemetry.",
        "schemaVersion": 1,
    }


@app.post("/simulation/start", status_code=201)
def start_session(payload: SessionRequest) -> dict[str, object]:
    prune_sessions()
    if len(sessions) >= MAX_SESSIONS:
        raise HTTPException(status_code=503, detail="Session capacity reached; use Local Lab")
    session_id = uuid.uuid4().hex
    sessions[session_id] = Session(session_id, payload.seed, payload.population, time.time())
    return {"sessionId": session_id, "seed": payload.seed, "population": payload.population, "mode": "local-required", "expiresIn": SESSION_TTL_SECONDS}


@app.get("/simulation/{session_id}")
def get_session(session_id: str) -> dict[str, object]:
    prune_sessions()
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"sessionId": session.id, "seed": session.seed, "population": session.population, "mode": "local-required"}


@app.websocket("/ws/simulation/{session_id}")
async def websocket_session(websocket: WebSocket, session_id: str) -> None:
    prune_sessions()
    if session_id not in sessions:
        await websocket.close(code=4404, reason="Session not found")
        return
    await websocket.accept()
    sequence = 0
    try:
        while True:
            sequence += 1
            await websocket.send_json({"type": "heartbeat", "sequence": sequence, "schemaVersion": 1, "mode": "local-required"})
            await asyncio.sleep(15)
    except WebSocketDisconnect:
        return
