# MS Project ↔ Excel full two-way schedule sync

Round-trip **any** open `.mpp` with Excel: names, dates, duration, `% Complete`, new tasks, and opt-in deletes. UniqueID is the join key (duplicate names are normal).

> VBA runs inside **Microsoft Project on Windows** with Excel installed. This environment did not run Project against the `.mpp`. This is a VBA export/edit/import loop — not a live OLE link.

## What you get

| Macro | Purpose |
| --- | --- |
| **`EditScheduleInExcel`** (alias **`EditProgressInExcel`**) | **Daily use** — export → open Excel → wait until save & close → full import |
| `ExportProgressToExcel` | Export only (does not open Excel) |
| `ImportProgressFromExcel` | Import only (edits + new rows + `Delete=Y`) |

**Sheet `Progress` columns**

| Column | Role |
| --- | --- |
| UniqueID (hidden) | Join key — leave blank on **new** rows only |
| Task Name | Create / rename |
| WBS | Context; parent hint for new rows (`1.6.9` → under `1.6`) |
| Outline Level | Indent for new / adjusted tasks |
| Start / Finish | Written both ways when Project accepts the change |
| Duration (days) | Working days both ways |
| % Complete | Leaf tasks only (summaries roll up — skipped on write) |
| Summary | Export guide (Y/N); not written back |
| Delete | Set **Y** to delete that UniqueID on import |

### New tasks

- Excel: add a row with **blank UniqueID** + Task Name (optional Outline / WBS parent hint, dates, duration, %).
- Import creates the task in Project. Next export fills in the new UniqueID.

### Deletes (safe by default)

- Rows **missing** from Excel are **kept** in Project (counted as “kept, not in Excel”).
- To delete: set **Delete=Y** on that row, save, import.
- Never silently wipe the programme.

### Project → Excel

- Any task added/changed in Project appears/updates on the next export (including via `EditScheduleInExcel`).

## One-time setup

1. Open your `.mpp` in Microsoft Project.
2. **Developer** → **Visual Basic** → open **ThisProject** (under the project, not Normal).
3. Paste from **[`docs/ThisProject-paste.bas`](ThisProject-paste.bas)** — **no** `VERSION` / `Attribute` header (those cause compile errors).
4. Save the `.mpp`.
5. Optional: `DefaultExcelPath()` → `%USERPROFILE%\Documents\Programme_Progress.xlsx`.

> `vba/ThisProject.cls` keeps the class header for git — **do not paste that header**.

## Daily workflow

1. Open the programme in Project.
2. Run **`EditScheduleInExcel`** (or `EditProgressInExcel`).
3. Confirm the workbook path if prompted.
4. In Excel: edit Name / Start / Finish / Duration / % Complete; add new blank-UniqueID rows; set Delete=Y only when you mean it. Save, **close Excel**.
5. Project waits (sleeps ~400ms between checks; prompts every 5 minutes — **No** skips import and **leaves Excel open**). Then imports and shows counts.
6. Save the `.mpp`.

## Sample schedule notes (`123.mpp`)

Offline OLE/MPXJ read (not Microsoft Project on Linux): 257 tasks, 177 leaf / 80 summary, outline 0–7, UniqueIDs unique with gaps. Inventory: [`samples/123-task-inventory.csv`](../samples/123-task-inventory.csv).

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Compile error on `VERSION` / `Attribute` | Paste `docs/ThisProject-paste.bas` only. |
| Cancel closed Excel / lost edits | Fixed: cancel skips import and leaves Excel open. |
| Wait ended while still editing a cell | Busy/1004 treated as still open; path match is case-insensitive with filename fallback (OneDrive). |
| Summaries % skipped | Expected — edit leaf % only. |
| Task not deleted after removing a row | Expected — use Delete=Y. |
| Date/duration rejected | Project constraints/calendars may block some writes; check the task in Project. |
