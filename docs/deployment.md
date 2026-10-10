# Deployment

## Frontend / Vercel

- Root directory: `apps/web`
- Framework: Next.js
- Install command: `npm install`
- Build command: `npm run build`
- Production URL: `https://synapse-city-taupe.vercel.app`.
- `NEXT_PUBLIC_API_URL=https://synapse-city-api.onrender.com` enables the non-blocking gateway status indicator.

## Gateway / Render

The root `render.yaml` defines one free native Python web service.

- Production URL: `https://synapse-city-api.onrender.com`.

- Root directory: `services/simulation-api`
- Build: `pip install -r requirements.txt`
- Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Health: `/health`
- No Dockerfile and no paid resource.

The frontend remains fully functional if this service is asleep or unavailable. It reports gateway availability without moving simulation ownership out of the browser Worker.
