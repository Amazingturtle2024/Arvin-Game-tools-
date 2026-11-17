# Arvin Game Tools

Utilities for Arvin’s planning workflow.

## MS Project ↔ Excel progress sync

Daily macro: **`EditProgressInExcel`** (export → edit in Excel → auto-import by UniqueID).

- **Paste into ThisProject:** [`docs/ThisProject-paste.bas`](docs/ThisProject-paste.bas) (no `VERSION`/`Attribute` header)
- Full class source (for git, not for pasting the header): [`vba/ThisProject.cls`](vba/ThisProject.cls)
- Setup and workflow: [`docs/project-excel-progress.md`](docs/project-excel-progress.md)
- Sample schedule: [`samples/123.mpp`](samples/123.mpp) (Sappi Saiccor Woodyard Stormwater draft)
- Task inventory (from offline parse): [`samples/123-task-inventory.csv`](samples/123-task-inventory.csv)

Requires Microsoft Project + Excel on Windows to run the macros.
