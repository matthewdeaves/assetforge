# Tasks: Sprite Generation Eval Harness

**Input**: Design documents from `/specs/002-sprite-eval-harness/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md

**Tests**: Not explicitly requested. Test tasks omitted.

**Organization**: Tasks grouped by user story. This is a small CLI tool (~4 source files) reusing existing Asset Forge services.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup

**Purpose**: Create directory structure, extract system prompt for versioning

- [x] T001 Create directory structure: eval/, eval/prompt-sets/, eval/system-prompts/, eval/results/
- [x] T002 Add eval/results/ to .gitignore

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Pixel stats calculator and judge service — shared by all user stories

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 [P] Create pixel statistics calculator in eval/stats.js: implement computeStats(pixels, palette, commands) that returns { totalPixels, filledPixels, coveragePercent, uniqueColors, paletteSize, paletteUtilization, commandCount, commandsByType }. Counts non-zero pixels for coverage, counts distinct palette indices for color usage, tallies commands by type
- [x] T004 [P] Create LLM judge service in eval/judge.js: implement judgeSprite(prompt, commands, stats, hint) that sends drawing commands, pixel statistics, and the original prompt to the LLM and parses a structured quality score response. The judge prompt asks the LLM to score 1-10 on: componentSeparation, colorUsage, detailDensity, spatialCoverage, promptAdherence — plus overall average and reasoning text. Parse the JSON response, handle unparseable responses by returning all-zeros with status "judge-failed". Use the existing LLM service's callOpenRouter function for the API call. Support configurable judge model via --judge-model flag (default same as generation model)
- [x] T005 [P] Extract current system prompt from server/services/llm.js into eval/system-prompts/current.js: export a function buildSystemPrompt(width, height) that returns the quality/style instruction portion of the system prompt — extract everything except palette injection and dimension substitution (read llm.js to determine boundaries). This is the baseline version for A/B testing

**Checkpoint**: Stats calculator and judge service work independently. System prompt extracted for versioning.

---

## Phase 3: User Story 1 — Run a Quality Evaluation (Priority: P1)

**Goal**: Developer runs `node eval/run.js` and gets scored results for every test prompt

**Independent Test**: Run `node eval/run.js` with a single-prompt test set, verify terminal output shows scores and a JSON report is saved

- [x] T006 [US1] Create default test prompt set in eval/prompt-sets/default.json with 10 prompts across 5 categories (2 per category): vehicles (top-down tank, side-view car), characters (knight, wizard), terrain (grass tile, water tile), items (wooden crate, treasure chest), obstacles (rock, tree). Each prompt has: prompt text, width, height, category, optional hint
- [x] T007 [US1] Create main CLI entry point in eval/run.js: parse command-line args (--system-prompt, --prompt-set, --gen-model, --judge-model per FR-010), load prompt set from eval/prompt-sets/{name}.json, load system prompt module from eval/system-prompts/{version}.js, iterate through each test prompt sequentially: generate sprite (using rasterizer + LLM service with the loaded system prompt via T008's generateSpriteWithPrompt), compute pixel stats, run judge, collect results. Handle generation failures per prompt (mark as failed, continue). After all prompts: compute summary averages, print summary table to terminal, save full JSON report to eval/results/{version}_{timestamp}.json
- [x] T008 [US1] Modify server/services/llm.js to export the internal callOpenRouter function (or add a generateSpriteWithPrompt function that accepts a custom system prompt string) so the eval harness can swap system prompts without patching

**Checkpoint**: `node eval/run.js` generates sprites, scores them, prints a summary table, and saves a JSON report.

---

## Phase 4: User Story 2 — Compare Two System Prompts (Priority: P1)

**Goal**: Developer runs eval twice with different system prompt versions and compares results

**Independent Test**: Create a second system prompt file, run eval with each, verify report filenames differ and scores can be compared

- [x] T009 [US2] Create a deliberately simple/bad system prompt in eval/system-prompts/minimal.js that gives the LLM only basic instructions (no quality guidelines) — this serves as the "known-bad" baseline for A/B testing and validates that the judge produces meaningfully different scores
- [ ] T010 [US2] Run two evals (one with `current`, one with `minimal` system prompt) using same prompt set and model. Verify: (a) report filenames include system prompt version and timestamp, (b) reports are distinct files, (c) average score difference between current and minimal is ≥ 3 points (per SC-003)

**Checkpoint**: Two reports exist with different prompt versions, scores are meaningfully different.

---

## Phase 5: User Story 3 — Manage Test Prompt Sets (Priority: P2)

**Goal**: Developer can create and use custom prompt set files

**Independent Test**: Create a custom 2-prompt set file, run eval with --prompt-set pointing to it, verify both prompts are evaluated

- [x] T011 [US3] Add validation in eval/run.js for prompt set loading: verify file exists, validate JSON structure (must have name, prompts array, each prompt must have prompt/width/height), print helpful error if file not found (list available prompt sets in eval/prompt-sets/)

**Checkpoint**: Custom prompt sets work. Bad files produce helpful error messages.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Error handling, edge cases

- [x] T012 Validate API key exists before starting eval run — exit immediately with clear message if openrouterkey file is missing and OPENROUTER_API_KEY env var is not set
- [x] T013 Add graceful interrupt handling (SIGINT) — save partial results for completed prompts before exiting
- [ ] T014 Run a full eval with default prompt set and verify: (a) all scores are in 1-10 range, no crashes, report is complete (SC-001), (b) run the same eval a second time with identical inputs and verify average dimension scores agree within 2 points (SC-002 judge consistency)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational
- **US2 (Phase 4)**: Depends on US1 (needs working eval to compare)
- **US3 (Phase 5)**: Depends on US1 (needs working eval to test custom sets)
- **Polish (Phase 6)**: Depends on US1

### Parallel Opportunities

- T003, T004, T005 (Foundational phase — all independent files)

---

## Implementation Strategy

### MVP First (User Story 1)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (stats + judge + system prompt extraction)
3. Complete Phase 3: US1 — Run an eval
4. **STOP and VALIDATE**: Run eval, verify scores make sense

### Incremental Delivery

1. Setup + Foundational → Stats and judge ready
2. Add US1 → Full eval pipeline works (MVP!)
3. Add US2 → A/B comparison with bad prompt validates scoring
4. Add US3 → Custom prompt sets
5. Polish → Error handling, graceful interrupts

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story
- Reuses server/services/rasterizer.js and server/services/llm.js — does NOT duplicate them
- eval/results/ is gitignored (reports contain large pixel arrays)
- Sequential evaluation (one prompt at a time) to respect OpenRouter rate limits
