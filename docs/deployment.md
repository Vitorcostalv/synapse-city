# Deployment

## Frontend / Vercel

- Root directory: `apps/web`
- Framework: Next.js
- Install command: `npm install`
- Build command: `npm run build`
- No required environment variables; `NEXT_PUBLIC_API_URL` is optional.

## Gateway / Render

The root `render.yaml` defines one free native Python web service.

- Root directory: `services/simulation-api`
- Build: `pip install -r requirements.txt`
- Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Health: `/health`
- No Dockerfile and no paid resource.

The frontend remains fully functional if this service is asleep or unavailable.
