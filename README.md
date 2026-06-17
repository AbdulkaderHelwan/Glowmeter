# GlowScan AI

AI face analysis web app with three modes — **Skin Analysis**, **Cosmetics Analysis**, and **Bio Age / Longevity** — plus a new client-side **Facial Geometry** engine (symmetry, canthal tilt, facial thirds, ratios) computed directly from facial landmarks.

Built with Next.js 16 (App Router), React 19, Tailwind, shadcn/ui, Prisma + SQLite, and `face-api.js` for in-browser face detection.

---

## Quick start

You need **[Bun](https://bun.sh)** (recommended, matches the project scripts) or Node 18+.

```bash
# 1. install dependencies
bun install

# 2. create the local SQLite database (a .env is already included)
bun run db:generate
bun run db:push

# 3. run the dev server
bun dev
```

Open http://localhost:3000

> Prefer npm? `npm install && npm run db:generate && npm run db:push && npm run dev` also works.

The `.env` shipped here uses a portable relative path (`file:./dev.db`), so it runs on any machine. `.env.example` documents it.

---

## What works offline vs. what needs an AI backend

This repo has two independent layers:

**1. Face detection + Facial Geometry — 100% client-side, works anywhere.**
Runs in the browser via `face-api.js` (models are in `public/models/`). You'll see it on the upload preview, the animated scan overlay, and the **Facial Geometry** card/overlay. This is where the recent accuracy fix lives — the overlay now lines up exactly with your eyes/jaw/midline on photos of **any aspect ratio**.

**2. The AI analysis (skin / cosmetics / bio-age / heatmap) — needs a vision model.**
These API routes (`src/app/api/analyze*`, `src/app/api/heatmap`) currently call `z-ai-web-dev-sdk` via `ZAI.create()`. That SDK is the original build platform's sandbox model and **may not work outside that environment**. If those calls fail, the upload → scan overlay still works, but the results screen won't populate.

**To make the AI analysis run standalone**, swap `ZAI.create()` in those routes for a real provider (Anthropic, OpenAI, or Google Gemini vision) with your own API key. Each route builds a text prompt + sends the image as a data URL and expects JSON back — the prompt logic stays identical; only the client call changes. (Ask and this can be wired up.)

---

## Verifying the face-detection fix

Upload photos at **different shapes** — a square crop, a wide landscape, a tall portrait. Previously the overlay only aligned on a 3:4 photo; now the geometry midline sits on the nose, the eye-axis dots on the actual eye corners, and the third-lines on brow/nose base for all of them. The **Facial Geometry → Show Map** toggle on a results page is the fastest visual confirmation.

---

## Project structure

```
src/
  app/
    page.tsx              # all UI (landing, upload, analyzing, results, history)
    api/                  # analyze, analyze-cosmetics, analyze-longevity, heatmap, scans, reminders
  lib/
    faceDetection.ts      # face-api.js wrapper — 68-pt landmarks, multi-scale detection
    faceGeometry.ts       # deterministic geometry engine (symmetry, tilt, thirds, ratios)
  components/ui/          # shadcn/ui components
public/models/            # face-api.js model weights (tiny detector + 68 landmarks)
prisma/schema.prisma      # Scan / User / Reminder models (SQLite)
```

---

