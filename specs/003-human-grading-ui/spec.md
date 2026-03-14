# Feature Specification: Human Grading Review UI

**Feature Branch**: `003-human-grading-ui`
**Created**: 2026-03-14
**Status**: Draft
**Input**: User description: "Browser-based review page for human grading of generated sprites to calibrate the LLM judge"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Grade Sprites Visually (Priority: P1)

As a developer, I want to visually review each generated sprite and score it on the same quality dimensions the LLM judge uses, so I can build a human-graded reference set for calibrating the judge.

**Why this priority**: Without the ability to see and score sprites, no calibration is possible. This is the core value of the feature.

**Independent Test**: Open the review page, load a report with at least one scored sprite, see the sprite rendered on a canvas, score all 5 dimensions using 1-5 buttons, advance to the next sprite, and verify scores are captured.

**Acceptance Scenarios**:

1. **Given** an eval report exists with at least one successful sprite, **When** the developer opens the review page, **Then** the first sprite is rendered on a canvas at a visible scale with the original prompt, quality hint, and pixel statistics displayed alongside it.
2. **Given** a sprite is displayed, **When** the developer selects a score (1-5) for each of the 5 quality dimensions and clicks "Next", **Then** the scores are recorded and the next sprite is displayed.
3. **Given** a sprite is displayed, **When** the developer clicks "Skip", **Then** no scores are recorded for that sprite and the next sprite is displayed.
4. **Given** the developer is grading sprites, **When** the LLM scores section is checked, **Then** it is hidden — LLM scores are not visible during human grading to prevent anchoring bias.

---

### User Story 2 - See Calibration Results (Priority: P1)

As a developer, I want to see how my scores compare to the LLM judge's scores after I finish grading, so I can identify which quality dimensions the judge gets wrong.

**Why this priority**: Comparison is the reason human grading exists — without it, grading is just busywork.

**Independent Test**: Complete grading for at least 3 sprites, click "Finish", and verify a calibration summary table appears showing per-dimension comparison stats.

**Acceptance Scenarios**:

1. **Given** the developer has graded all sprites (or clicked "Finish Early"), **When** the summary view loads, **Then** a calibration table is displayed showing: human average, LLM average, mean absolute difference, and agreement rate (scores within 1 point) for each dimension.
2. **Given** the calibration table is displayed, **When** any dimension has a mean absolute difference greater than 1 point, **Then** that dimension row is visually highlighted as a calibration concern.
3. **Given** the calibration table is displayed, **When** the developer reviews the table, **Then** the LLM's per-sprite scores are now revealed alongside the human scores for detailed comparison.

---

### User Story 3 - Save Human Scores to Report (Priority: P1)

As a developer, I want my human scores saved back into the eval report file, so they persist across sessions and can be used for future calibration analysis.

**Why this priority**: Scores must persist — otherwise the developer has to re-grade every time.

**Independent Test**: Grade at least one sprite, finish grading, reload the report file from disk, and verify it contains a `humanScores` field on the graded result entries.

**Acceptance Scenarios**:

1. **Given** the developer finishes grading, **When** the save completes, **Then** each graded sprite's result in the report has a `humanScores` object with the 5 dimension scores and a timestamp.
2. **Given** a report already has human scores from a previous session, **When** the developer opens the review page for that report, **Then** the page indicates that human scores already exist and offers to re-grade (replacing existing scores) or view the calibration summary directly.

---

### User Story 4 - Select Which Report to Review (Priority: P2)

As a developer, I want to choose which eval report to review from a list of available reports, so I can grade results from different eval runs.

**Why this priority**: Important for workflow but not core — the page can default to the most recent report.

**Independent Test**: With two or more reports in the results directory, open the review page and verify a dropdown lists all available reports with the most recent selected by default.

**Acceptance Scenarios**:

1. **Given** multiple eval reports exist, **When** the review page loads, **Then** a dropdown lists all reports sorted by timestamp (most recent first) with the most recent pre-selected.
2. **Given** the dropdown is showing, **When** the developer selects a different report, **Then** the page loads that report and begins the grading flow from the first sprite.

---

### Edge Cases

- What happens when the selected report has zero successful sprites? Display a message indicating no sprites are available for grading.
- What happens when a sprite result has a null pixel grid (generation failed)? Skip it automatically and show only successfully generated sprites.
- What happens when the developer closes the browser mid-grading? Partial scores are lost — grading must be completed in one session (scores are saved only on "Finish").
- What happens when there are no report files available? Display a message instructing the developer to run `node eval/run.js` first.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST serve a review page accessible from the existing web server.
- **FR-002**: The system MUST render each sprite on a canvas using the pixel grid data and palette from the eval report, scaled up so individual pixels are clearly visible.
- **FR-003**: The system MUST display the original prompt, quality hint (if present), and pixel statistics (coverage, command count, color utilization) alongside each sprite.
- **FR-004**: The system MUST present the 5 quality dimensions (componentSeparation, colorUsage, detailDensity, spatialCoverage, promptAdherence) with their rubric descriptions and a 1-5 score selector for each.
- **FR-005**: The system MUST hide LLM scores during human grading to prevent anchoring bias.
- **FR-006**: The system MUST allow the developer to skip a sprite without scoring it.
- **FR-007**: The system MUST allow the developer to finish grading early (before reviewing all sprites).
- **FR-008**: The system MUST display a calibration summary after grading completes, showing per-dimension: human average, LLM average, mean absolute difference, and agreement rate.
- **FR-009**: The system MUST visually highlight dimensions where human and LLM scores disagree by more than 1 point on average.
- **FR-010**: The system MUST save human scores back to the eval report file via a server endpoint.
- **FR-011**: The system MUST list available eval reports and allow the developer to select which one to review.
- **FR-012**: The system MUST show a progress indicator (e.g., "Sprite 3 of 10") during grading.
- **FR-013**: The system MUST reveal per-sprite LLM scores after grading is complete so the developer can see where specific disagreements occurred.
- **FR-014**: The system MUST detect when a report already has human scores and offer to view calibration results directly or re-grade.

### Key Entities

- **Human Scores**: Per-sprite scores on the 5 quality dimensions (1-5 scale), with a grading timestamp. Stored as a `humanScores` field on each result entry in the report.
- **Calibration Summary**: Computed comparison between human and LLM scores per dimension — averages, mean absolute difference, agreement rate.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Developer can load a report, visually grade all sprites, and see calibration results in a single session without needing any other tool.
- **SC-002**: LLM scores are never visible during the grading phase — the developer cannot see them until after finishing.
- **SC-003**: After grading, the calibration summary identifies any dimension where human and LLM scores differ by more than 1 point on average.
- **SC-004**: Human scores persist in the report file and survive page reloads and server restarts.
- **SC-005**: The sprite rendering on canvas matches the pixel-accurate rendering used elsewhere in the project (same palette mapping, same pixel grid interpretation).

## Assumptions

- The eval harness (feature 002) is complete and produces report files with pixel data and LLM scores.
- The existing web server is already serving the frontend.
- Eval reports contain pixel grid data, palette data, and LLM scores for each successfully generated sprite.
- The developer is the only user — no multi-user or concurrent grading scenarios.
- A grading session covers one report at a time.

## Dependencies

- Feature 002 (Sprite Eval Harness) — provides eval report files with pixel data and LLM scores.
- Existing web server — serves the review page and API endpoints.

## Scope Boundaries

**In scope**: Visual sprite review, human scoring UI, calibration comparison, report selection, score persistence.

**Out of scope**: Re-running evals from the UI, editing LLM scores, image export, multi-user support, authentication.
