# Planform

Construction project planning system. Module 01 — **Tender & Contract Review**.

Upload tender, contract, specification and BOQ files. The module extracts only what those files state, with page, sheet, paragraph and clause citations. It never assumes a contract type and never invents a clause.

Later modules (BOQ analysis, activities, durations, programme, MS Project, baseline, updates, delay analysis, progress reporting) are scaffolded in the module list and are not implemented yet.

## Run locally

```bash
npm install
npm test
npm run dev
```

Open http://127.0.0.1:3000. On this machine the signed-in viewer is simulated.

## Rules the extractor follows

- Contract family is reported only when those words appear in a file.
- Every finding keeps a quote and a location.
- General conditions are separated from contract data, particular conditions and Z clauses where the file makes that distinction.
- Conflicting statements are listed together. Nothing is chosen between them.
- Planner checklist items that are not in the files are listed as missing.
