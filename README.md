# Arvin Game Tools

Utilities for Arvin’s planning workflow.

## MS Project ↔ Excel full two-way schedule sync

Daily macro: **`EditScheduleInExcel`** (alias `EditProgressInExcel`) — export → edit in Excel → auto-import (names, dates, duration, % Complete, new tasks, opt-in Delete=Y).

- **Paste into ThisProject:** [`docs/ThisProject-paste.bas`](docs/ThisProject-paste.bas) (no `VERSION`/`Attribute` header)
- Full class source (git only — don’t paste the header): [`vba/ThisProject.cls`](vba/ThisProject.cls)
- Setup: [`docs/project-excel-progress.md`](docs/project-excel-progress.md)
- Sample: [`samples/123.mpp`](samples/123.mpp) · [`samples/123-task-inventory.csv`](samples/123-task-inventory.csv)

Requires Microsoft Project + Excel on Windows.
