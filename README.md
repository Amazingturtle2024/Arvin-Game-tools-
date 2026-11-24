# Planform

Construction project planning system.

- Module 01 — **Tender & Contract Review**
- Module 02 — **Drawings, Quantities & Durations**
- Module 03 — **Construction Programme (Gantt)**

Module 01 reads tender, contract, specification and BOQ files. It extracts only what those files state, with citations. The bill is listed line by line (item, unit, quantity, rate, amount). It never assumes a contract type.

Module 02 reads drawings, calculates quantities with formulas, compares them with the BOQ without changing either figure, applies your production-rate table, and reports working-day durations. Missing dimensions stay missing.

Module 03 builds an editable construction programme from that information: project setup (pre-filled from the tender), WBS from the actual measured works and bill (not a generic finishes template), working calendar, CPM, Gantt chart, checks, Excel / PDF / Microsoft Project 2013 XML export, and a baseline revision. Quantities, rates and curing periods that are not stated stay blank.

Later modules (programme updates, delay analysis, progress reporting) are listed in the sidebar and not implemented yet.

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

## Module 02 rules

- Missing dimensions are not invented. A wall footing with length and width but no depth stays uncalculated.
- Every quantity shows the formula, the numbers used, and the drawing they came from.
- Production rates live in your table. Starter values are labelled until you edit them.
- Duration = quantity ÷ (rate per day × teams × hours/8) × (1 + weather %). Working days, not calendar days.
- Raster drawings (PNG/JPEG) are stored but not measured from pixels.
- Results are stored as a programme handoff. Module 03 turns that into a Gantt chart and can export Microsoft Project 2013 XML.
- BOQ versus drawing is item by item. A difference is reported; neither quantity is rewritten.
- After drawings are uploaded they are measured: concrete in m³, reinforcement in tonnes per element, area in m². Further measure kinds can be added later.

## Module 03 rules

- Setup fields are filled from Module 01 and 02 where those files stated them. Blank fields stay blank for the planner to complete.
- The WBS is built from the actual bill and take-off. Plaster, paint and commissioning are not added unless they appear in the pack.
- Duration = quantity ÷ (rate per day × teams). Hours/8 and weather % apply when entered. Missing rates stay uncalculated.
- Recommended relationships (FS, SS, FF, SF) are labelled until you edit or approve them.
- Approved activities are not rewritten when the programme is rebuilt.
- Dates follow the working calendar. Public holidays are skipped only if you list them.
