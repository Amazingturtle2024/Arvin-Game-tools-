# THE LOST KINGDOM — Vision (trimmed)

## Elevator pitch

You are an explorer stranded in a mysterious tropical jungle after following an ancient map. Survive, explore ruins, and uncover the secrets of a forgotten kingdom.

## Current build

- **Format:** 2D top-down browser game (Phaser 3)
- **Art direction:** Bright pixel-jungle look inspired by [`Docs/reference/jungle-pixel-style.jpg`](reference/jungle-pixel-style.jpg) (cliffs, river, wooden bridge, pines, mushrooms)
- **Player:** Chibi knight (silver armor, red plume, glowing shield) from [`Docs/reference/player-knight.png`](reference/player-knight.png)
- **Phase 1 shipped:** Move through a detailed jungle map and recover an ancient map scrap
- **Not yet built:** Combat, inventory, wildlife AI, multi-mission campaign, save system

## Tone

Adventure, exploration, light survival. Story unfolds through places and objects (crash site → jungle path → cave → temple → kingdom), not cutscene dumps.

## Design rules for future prompts

1. Stay **2D Phaser** unless we explicitly change stack.
2. Add **one feature at a time**.
3. Do not rewrite the whole game for a small feature.
4. Prefer simple placeholder art until we deliberately upgrade visuals.
5. Keep controls beginner-friendly (keyboard first).

## Long-term feature backlog (inspiration only)

- Health / stamina
- Inventory and pickups
- Wildlife with basic patrol / detect / chase
- Mission objectives UI
- Cave and temple maps
- Puzzles and environmental storytelling
- Save / load (`localStorage`)
- Stronger art, sound, and atmosphere

Use `Docs/PROMPTS/ADDONS.md` when asking Cursor to implement the next piece.
