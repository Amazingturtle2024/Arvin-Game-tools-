# MS Project ↔ Excel progress sync

Edit task **% Complete** in Excel and push updates back into Microsoft Project. Built for Arvin’s Sappi Saiccor Woodyard Stormwater programme (`samples/123.mpp`): deep WBS, many summary rows, and duplicate leaf names.

> VBA runs inside **Microsoft Project on Windows** with Excel installed. This environment did not run Project against the `.mpp`.

## What you get

| Macro | Purpose |
| --- | --- |
| **`EditProgressInExcel`** | **Daily use** — export → open Excel → wait until you save & close → import automatically |
| `ExportProgressToExcel` | Export only (no Excel open; no auto-import) |
| `ImportProgressFromExcel` | Import only (if you already edited the workbook) |

**Columns:** UniqueID (hidden join key), Task Name, WBS, Outline Level, Start, Finish, % Complete, Summary (Y/N).

**Import rules**

- Join key is **UniqueID** only (names like `Rebar` / `Concrete` repeat under different headwalls).
- **% Complete** is written on **leaf tasks only**. Summary rows roll up from children — Project rejects direct % writes; those rows are skipped (counted in the result MsgBox).
- Task Name can change on any matched UniqueID (only when Trimmed text actually differs — no space-only rewrites).
- New tasks are never created. Unknown UniqueIDs are reported as missing.

## One-time setup

1. Open your `.mpp` in Microsoft Project (e.g. `samples/123.mpp` or your live programme).
2. **Developer** tab → **Visual Basic** (enable under File → Options → Customize Ribbon if needed).
3. Open **ThisProject** under the open project (not Normal).
4. **Paste from [`docs/ThisProject-paste.bas`](ThisProject-paste.bas)** — that file has **no** `VERSION` / `Attribute` header lines (those cause compile errors if pasted into an existing ThisProject). Replace any older progress-sync code in the module.
5. Save the `.mpp`.
6. Optional: change `DefaultExcelPath()` (default `%USERPROFILE%\Documents\Programme_Progress.xlsx`). Sheet name: `PROGRESS_SHEET_NAME = "Progress"`.

No Excel library reference is required (late-bound `CreateObject("Excel.Application")`).

> Repo also keeps `vba/ThisProject.cls` with the full class header for source control — **do not paste that header** into ThisProject; use the `.bas` paste file.

## Daily workflow (recommended)

1. Open the programme in Project.
2. Run **`EditProgressInExcel`** (Developer → Macros).
3. Confirm/edit the workbook path in the InputBox if prompted.
4. Excel opens on sheet **Progress**. Filter **Summary = N**, edit leaf **% Complete** (e.g. set Vdrain to 100), optionally rename tasks. Save (Ctrl+S), then **close Excel**.
5. Project detects the close (status bar / wait prompts every few minutes if Excel stays open) and runs the import. Read the MsgBox counts.
6. Save the `.mpp`.

Split Export / Import macros remain available if you need them; standalone Export does **not** auto-open Excel (avoids surprise). Prefer `EditProgressInExcel` for the round-trip.

## Sample schedule notes (`123.mpp`)

Inspected offline as an OLE Compound Document (MPP14 / Project 15.x) — not opened in Microsoft Project here.

| Fact | Value |
| --- | --- |
| Title | new version |
| Author | Arvin Singh |
| Window | 2026-10-19 → 2027-03-01 |
| Tasks | 257 (UniqueID 0…367, unique; IDs are not contiguous) |
| Leaves / summaries | 177 / 80 |
| Outline depth | levels 0–7 |
| % Complete (as read) | all 0% |

Read-only inventory: [`samples/123-task-inventory.csv`](../samples/123-task-inventory.csv).

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Compile error on `VERSION` / `Attribute` | Paste from `docs/ThisProject-paste.bas`, not the `.cls` header. |
| “Excel is not installed” | Install desktop Excel; automation needs the Excel app. |
| Waiting forever after edit | Save and **close Excel** (not only the window minimized). Cancel via the periodic Yes/No prompt if needed, then run `ImportProgressFromExcel`. |
| File not found on import | Use the InputBox path, or run `EditProgressInExcel` / Export first. |
| Sheet `Progress` missing | Don’t rename the sheet; re-export if needed. |
| Summaries skipped | Expected — edit leaf % only; summaries roll up. |
| UniqueID not found | You may be importing into a different `.mpp` than the one exported. |
| Protected sheet | Export locks join/context columns but allows AutoFilter/sort (filter Summary = N). Review → Unprotect Sheet only if you need to edit locked cells. |
