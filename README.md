# THE LOST KINGDOM

A **2D top-down** jungle adventure starter built with **Phaser 3**, **Vite**, and **TypeScript**.

Phase 1: walk the jungle, hold **Shift** to run, and recover the ancient map scrap.

## Requirements

- Node.js 20+ (18+ may work)
- A modern browser

## Run locally

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://127.0.0.1:5173`).

## Controls

| Input | Action |
| --- | --- |
| WASD / Arrow keys | Move |
| Shift | Run |
| Enter (on menu) | Start |
| Click Begin Expedition | Start |

## Build

```bash
npm run build
npm run preview
```

## Project layout

- `src/main.ts` — entry
- `src/game.ts` — Phaser config
- `src/scenes/` — Boot, MainMenu, Jungle
- `src/entities/Player.ts` — movement
- `Docs/VISION.md` — long-term direction
- `Docs/PROMPTS/ADDONS.md` — prompts for the next features
- `Docs/ROADMAP.md` — phase checklist

## Adding features later

Do not paste the full AAA design doc. Open `Docs/PROMPTS/ADDONS.md` and send Cursor **one** add-on prompt at a time.
