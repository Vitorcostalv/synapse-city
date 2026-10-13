# Synapse City — LinkedIn film v2

## Deliverables

- `synapse-city-linkedin-v2.mp4`: 27-second master, 1080 × 1350, 30 FPS, H.264 + AAC.
- `synapse-city-cover-v2.png`: 1080 × 1350 cover made from a real application capture.
- `synapse-city-preview.mp4`: 432 × 540 inspection copy.
- `validation-v2-final/`: frames extracted at the principal narrative beats.
- `video-v2-metadata.json`: machine-readable master metadata.

## Reproducing the render

From the repository root:

```bash
npm install
npm run video:linkedin:v2
```

The renderer builds the app, starts a local production server, records seven independent high-resolution shots from `/capture`, generates an original procedural electronic score, composes the 27-second master, creates the cover and preview, validates the media metadata, and extracts QA frames.

The capture route uses the real local simulation worker. It does not replace agent movement, decision traces, needs, Q-values, rewards, or memories with display-only data. The comparison uses the reproducible repository evaluation: random `0.395`, Q-learning `0.470`, and heuristic `0.485`.

The soundtrack is generated locally by `scripts/render-linkedin-video-v2.mjs`; it does not contain third-party samples or protected music.
