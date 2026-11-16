# Arvin Game Tools

Utilities for Arvin’s planning workflow.

## MS Project ↔ Excel progress sync

VBA in [`vba/ThisProject.cls`](vba/ThisProject.cls) exports task progress to Excel and imports `% Complete` updates by **UniqueID**.

- Setup and workflow: [`docs/project-excel-progress.md`](docs/project-excel-progress.md)
- Sample schedule: [`samples/123.mpp`](samples/123.mpp) (Sappi Saiccor Woodyard Stormwater draft)
- Task inventory (from offline parse): [`samples/123-task-inventory.csv`](samples/123-task-inventory.csv)

Requires Microsoft Project + Excel on Windows to run the macros.
