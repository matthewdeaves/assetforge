# Tasks: Human Grading Review UI

**Input**: Design documents from `/specs/003-human-grading-ui/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md

**Tests**: Not explicitly requested. Test tasks omitted.

**Organization**: Tasks grouped by user story. This feature adds 1 HTML page, 1 JS file, 1 CSS file, and 1 API route file to the existing Asset Forge server.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Phase 1: Setup

**Purpose**: Register eval API routes in the existing Express server

- [X] T001 Create server/routes/eval.js with Express router skeleton exporting an empty router. Register it in server/index.js as `app.use('/api', evalRoutes)` alongside the existing project/sprite/export routes

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: API endpoints that serve all user stories — load reports, get report data, save human scores

**CRITICAL**: No frontend work can begin until these endpoints exist

- [X] T002 Implement GET /api/eval/reports in server/routes/eval.js: read eval/results/ directory, for each JSON file parse the report to extract metadata (filename, systemPromptVersion, timestamp, promptSetName, totalPrompts, successCount, hasHumanScores), return sorted by timestamp descending. Return empty array if directory doesn't exist. Per contracts/api.md response format
- [X] T003 Implement GET /api/eval/reports/:filename in server/routes/eval.js: read and return the full report JSON from eval/results/{filename}. Validate filename contains no path traversal characters (`..`, `/`, `\`) — return 400 for invalid filenames. Return 404 if file not found. Per contracts/api.md
- [X] T004 Implement POST /api/eval/reports/:filename/human-scores in server/routes/eval.js: accept request body with `scores` array (each entry has `index` and `humanScores` per data-model.md), validate all dimension scores are integers 1-5, read existing report from disk, merge humanScores into each result by index, write updated report back to disk. Return 400 for invalid scores, 404 if report not found. Per contracts/api.md

**Checkpoint**: All three API endpoints work. Can test with curl.

---

## Phase 3: User Story 1 — Grade Sprites Visually (Priority: P1)

**Goal**: Developer opens review.html, sees a rendered sprite, scores it on 5 dimensions, advances through all sprites

**Independent Test**: Open http://localhost:3777/review.html with a report containing at least one successful sprite, verify canvas renders the sprite, score all 5 dimensions, click Next, verify next sprite appears

- [X] T005 [P] [US1] Create public/review.html with page layout: header area (report selector dropdown, progress indicator), main content area (left: canvas for sprite rendering; right: prompt text, quality hint, pixel stats, and 5 scoring dimensions each with 1-5 button group), footer (Skip button, Next button, Finish Early button). Include links to public/css/review.css and public/js/review.js
- [X] T006 [P] [US1] Create public/css/review.css with styles for the review page: two-column layout (canvas left, scoring panel right), button groups for 1-5 score selection (highlight selected score), progress bar or counter, responsive sizing for canvas area, clear visual separation between dimensions. Rubric descriptions styled as small helper text under each dimension name
- [X] T007 [US1] Create public/js/review.js with core grading logic: on page load fetch the most recent report via GET /api/eval/reports then GET /api/eval/reports/:filename, filter results to only status==="success" entries, render the first sprite's pixel grid on a canvas element (read pixels[][] and palette[] from result, map each palette index to RGB, scale each pixel to 8x8 screen pixels using canvas fillRect), display prompt text, hint, and stats (coveragePercent, commandCount, paletteUtilization). Show the 5 dimension names with rubric descriptions from eval/judge.js DIMENSION_RUBRICS (hardcode the rubric text in the JS since this is plain JS, no imports). Each dimension has 5 clickable score buttons (1-5). LLM scores are NOT shown (FR-005). Show progress as "Sprite N of M". "Next" button records scores in an in-memory array and advances to next sprite. "Skip" button advances without recording. "Finish Early" triggers the finish flow (US2/US3). Add a `beforeunload` event listener that warns the developer if they try to close/navigate away while grading is in progress with unsaved scores
- [X] T008 [US1] Add keyboard shortcuts to public/js/review.js: number keys 1-5 set the score for the currently focused dimension, Tab moves between dimensions, Enter triggers Next, Escape triggers Skip. Display shortcut hints in the UI

**Checkpoint**: `node eval/run.js` then open review.html — sprites render, scoring works, navigation works. LLM scores are hidden.

---

## Phase 4: User Story 2 — See Calibration Results (Priority: P1)

**Goal**: After grading, developer sees a calibration summary comparing their scores vs the LLM judge

**Independent Test**: Grade at least 3 sprites, click Finish, verify calibration table appears with per-dimension stats and flagged dimensions

- [X] T009 [US2] Add calibration summary view to public/js/review.js: when grading finishes (all sprites reviewed or "Finish Early" clicked), compute CalibrationSummary per data-model.md — for each of the 5 dimensions calculate humanAvg, llmAvg, meanAbsoluteDifference, agreementRate (% of sprites where |human - llm| <= 1). Flag dimensions with MAD > 1.0. Switch the page to a summary view showing: a table with columns (Dimension, Human Avg, LLM Avg, Difference, Agreement Rate), rows highlighted in red/warning if flagged (FR-009), overall averages, and counts (graded/skipped/total)
- [X] T010 [US2] Add per-sprite score comparison to the calibration summary view in public/js/review.js: below the summary table, show a scrollable list of all graded sprites — each row shows: small canvas thumbnail (scaled down), prompt text, and a mini-table of human score vs LLM score for each dimension, with cells highlighted where |human - llm| > 1 (FR-013). This reveals the LLM scores for the first time

**Checkpoint**: After grading, calibration table shows meaningful comparison. Flagged dimensions are visually highlighted. Per-sprite breakdowns are visible.

---

## Phase 5: User Story 3 — Save Human Scores to Report (Priority: P1)

**Goal**: Human scores persist in the report JSON file after grading

**Independent Test**: Grade sprites, finish, reload the report JSON from disk, verify humanScores fields exist

- [X] T011 [US3] Add save logic to public/js/review.js: when the calibration summary view is shown (after grading finishes), POST the collected human scores to /api/eval/reports/:filename/human-scores per contracts/api.md. Construct the request body with scores array containing index and humanScores for each graded sprite (skipped sprites omitted). Show a save confirmation message. Handle save errors with a retry button
- [X] T012 [US3] Add re-grade detection to public/js/review.js: when a report is loaded, check if any result has a non-null humanScores field. If so, show a modal/banner with two options: "View Results" (jump directly to calibration summary view using existing human + LLM scores) or "Re-Grade" (start fresh grading, existing human scores will be overwritten on save). Per FR-014

**Checkpoint**: Human scores persist across page reloads. Re-opening a graded report shows the re-grade/view options.

---

## Phase 6: User Story 4 — Select Which Report to Review (Priority: P2)

**Goal**: Developer can choose which eval report to review from a dropdown

**Independent Test**: With 2+ reports in eval/results/, verify dropdown lists them sorted by timestamp, selecting one loads it

- [X] T013 [US4] Add report selector to public/js/review.js: on page load, fetch GET /api/eval/reports and populate the dropdown in the header with report entries (show systemPromptVersion, timestamp, and promptSetName for each). Pre-select the most recent. When selection changes, load the new report and reset the grading state. Show "No reports found — run node eval/run.js first" if the list is empty. Show "No successful sprites in this report" if the loaded report has zero status==="success" results

**Checkpoint**: Dropdown lists all reports. Switching reports resets the grading flow.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases, validation, final verification

- [X] T014 Run full end-to-end validation: start server, run an eval with `node eval/run.js`, open review.html, grade all sprites, verify calibration summary displays correctly, verify human scores are saved to the report JSON file, reload page and verify re-grade detection works, select a different report and verify grading resets

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all frontend work
- **US1 (Phase 3)**: Depends on Foundational (needs GET report endpoint)
- **US2 (Phase 4)**: Depends on US1 (needs grading flow to produce scores to compare)
- **US3 (Phase 5)**: Depends on US2 (save triggers after calibration summary view)
- **US4 (Phase 6)**: Depends on US1 (needs the grading page to exist). Can be built in parallel with US2/US3 if working on different sections of review.js
- **Polish (Phase 7)**: Depends on all user stories

### Parallel Opportunities

- T005, T006 (HTML and CSS — no dependencies between them)
- T009, T010 could be parallelized if split into separate files, but both modify review.js so should be sequential

---

## Implementation Strategy

### MVP First (User Story 1)

1. Complete Phase 1: Setup (register routes)
2. Complete Phase 2: Foundational (3 API endpoints)
3. Complete Phase 3: US1 — Visual grading works
4. **STOP and VALIDATE**: Open review.html, grade sprites, verify rendering and scoring

### Incremental Delivery

1. Setup + Foundational → API ready
2. Add US1 → Sprites render, grading works (MVP!)
3. Add US2 → Calibration summary after grading
4. Add US3 → Scores persist to disk
5. Add US4 → Report selector dropdown
6. Polish → End-to-end validation

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story
- All frontend code is plain HTML/CSS/JS (no framework per constitution)
- Reuses existing Express server at localhost:3777
- Pixel rendering uses same palette-index-to-RGB approach as rest of Asset Forge
- LLM scores hidden during grading (anchoring bias prevention per Anthropic best practice)
- Rubric text is hardcoded in review.js since plain JS can't import from Node modules
