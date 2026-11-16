# MS Project ↔ Excel progress sync

Edit task **% Complete** in Excel, then push updates back into Microsoft Project. Built for Arvin’s Sappi Saiccor Woodyard Stormwater programme (`samples/123.mpp`): deep WBS, many summary rows, and duplicate leaf names.

> VBA runs inside **Microsoft Project on Windows** with Excel installed. This environment did not run Project against the `.mpp`.

## What you get

| Macro | Purpose |
| --- | --- |
| `ExportProgressToExcel` | Writes all tasks to `Programme_Progress.xlsx` (sheet `Progress`) |
| `ImportProgressFromExcel` | Reads that workbook and updates matching tasks by **UniqueID** |

**Columns:** UniqueID (hidden join key), Task Name, WBS, Outline Level, Start, Finish, % Complete, Summary (Y/N).

**Import rules**

- Join key is **UniqueID** only (names like `Rebar` / `Concrete` repeat under different headwalls).
- **% Complete** is written on **leaf tasks only**. Summary rows roll up from children — Project rejects direct % writes; those rows are skipped (counted in the result MsgBox).
- Task Name can change on any matched UniqueID.
- New tasks are never created. Unknown UniqueIDs are reported as missing.

## One-time setup

1. Open your `.mpp` in Microsoft Project (e.g. `samples/123.mpp` or your live programme).
2. **Developer** tab → **Visual Basic** (enable the tab under File → Options → Customize Ribbon if needed).
3. In the Project VBA editor, open **ThisProject** (under the open project, not Normal).
4. Paste the module body from [`vba/ThisProject.cls`](../vba/ThisProject.cls) into ThisProject (keep or replace the class `Attribute` header to match a document module).
5. Save the `.mpp` (macros require a macro-enabled Project file; Project will prompt as needed).
6. Optional: change the default Excel path in `DefaultExcelPath()` (currently `%USERPROFILE%\Documents\Programme_Progress.xlsx`). Sheet name constant: `PROGRESS_SHEET_NAME = "Progress"`.

No Excel library reference is required (late-bound `CreateObject("Excel.Application")`).

## Daily workflow

1. Open the programme in Project.
2. Run **ExportProgressToExcel** (Developer → Macros, or `Call ExportProgressToExcel`). Confirm or edit the export path in the InputBox.
3. Open the workbook in Excel. Filter **Summary = N** to see editable leaf rows (summary rows are grey / % locked).
4. Edit **% Complete** (0–100). Optionally rename tasks. Do not clear UniqueID (column A, hidden).
5. Save and close Excel.
6. Back in Project, run **ImportProgressFromExcel**. Read the MsgBox counts (% updated, summaries skipped, missing IDs).
7. Save the `.mpp`.

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
| “Excel is not installed” | Install desktop Excel; automation needs the Excel app. |
| File not found on import | Use the InputBox path, or re-export first. |
| Sheet `Progress` missing | Don’t rename the sheet; re-export if needed. |
| Summaries skipped | Expected — edit leaf % only; summaries roll up. |
| UniqueID not found | You may be importing into a different `.mpp` than the one exported. |
| Protected sheet | Export uses empty-password protection so only Name / leaf % are editable; Review → Unprotect Sheet if you need more. |
