# Paste-ready add-on prompts

Copy **one** block at a time into Cursor after Phase 1 feels good.

---

## Add-on: Health HUD

```text
PROJECT: THE LOST KINGDOM — ADD-ON ONLY
Stack: Phaser 3 + Vite + TypeScript. Keep the existing 2D top-down game.

Add a simple player health system (max 100) and a small HUD bar.
Walking into a rock does nothing; later we will add damage sources.
Do not add combat, inventory, AI, or new maps.
Explain files changed and how to test in the browser.
```

---

## Add-on: Simple enemy

```text
PROJECT: THE LOST KINGDOM — ADD-ON ONLY
Stack: Phaser 3 + Vite + TypeScript. Do not rewrite the game.

Add one jungle predator placeholder that patrols between two points.
If the player enters a detection radius, it chases briefly, then returns to patrol.
Contact reduces health if health exists; otherwise just knock the player back slightly.
No weapons, inventory, or new missions.
```

---

## Add-on: Inventory + pickup

```text
PROJECT: THE LOST KINGDOM — ADD-ON ONLY
Keep current scenes. Add a tiny inventory (array of item ids) and one extra pickup
(e.g. medkit or torch) on the jungle map. Press I to toggle a simple inventory panel.
Do not add crafting, equipment slots, or save/load yet.
```

---

## Add-on: Mission checklist UI

```text
PROJECT: THE LOST KINGDOM — ADD-ON ONLY
Add a Mission 1 checklist overlay:
1) Explore the jungle path
2) Recover the map scrap
Mark objectives complete when conditions are met.
No new maps. No save system.
```

---

## Add-on: Second map (cave entrance)

```text
PROJECT: THE LOST KINGDOM — ADD-ON ONLY
After collecting the map scrap, allow the player to reach a cave entrance trigger
and load a simple Cave scene (darker palette, a few rocks, one exit back to jungle).
Keep art as generated placeholders. No puzzles yet.
```

---

## Add-on: Save / load

```text
PROJECT: THE LOST KINGDOM — ADD-ON ONLY
Save player position, found-map flag, and inventory to localStorage.
Main menu gets Continue when a save exists.
Do not add cloud saves or settings menus beyond this.
```
