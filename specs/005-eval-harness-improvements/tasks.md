# Tasks: Eval Harness Improvements

**Input**: Design documents from `/specs/005-eval-harness-improvements/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/cli.md

**Tests**: Not explicitly requested. Test tasks omitted.

**Organization**: Tasks grouped by user story. US1 (prompts) and US4 (spatial coverage) are P1 and can be done first. US2 (grid sizes) is P1 but depends on the new prompt set. US3 (multi-shot) is P2 and the most complex change.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: No shared setup needed — all changes modify existing files.

(No setup tasks — this feature modifies existing eval infrastructure only.)

---

## Phase 2: User Story 4 — LLM-Judged Spatial Coverage (Priority: P1)

**Goal**: Move spatial coverage from code-based to LLM-judged for better calibration

**Independent Test**: Run an eval, verify spatial coverage has LLM reasoning (not "Code-based: X% pixel coverage"), human-grade and check MAD < 0.85

- [ ] T001 [US4] Move `spatialCoverage` from `computeCodeBasedScores()` to the `llmDimensions` array in `eval/judge.js`. Remove the spatialCoverage scoring from `computeCodeBasedScores()` (keep the coverage percentage in stats). Remove the `spatialCoverage` and `spatialCoverageReasoning` entries from the initial `scores` object in `judgeSprite()`. Add `'spatialCoverage'` to the `llmDimensions` array so it gets vision + parallel execution automatically
- [ ] T002 [US4] Update the `spatialCoverage` rubric description in `DIMENSION_RUBRICS` in `eval/judge.js`: change from fixed percentage thresholds to "Consider whether coverage is appropriate for the subject's natural shape — a round boulder at 60% is fine, a thin key at 25% is fine, but a bus filling only 40% of the grid is too small. The raw pixel coverage percentage is provided in the statistics for reference."
- [ ] T003 [US4] Update the `spatialCoverage` anchors in `eval/judge.js` to be context-aware instead of percentage-based. Score 1: "Sprite is far too small or poorly positioned for its subject — large empty areas where the subject should fill." Score 3: "Coverage is adequate but not optimal — subject could use the grid space better." Score 5: "Coverage is ideal for the subject's natural shape — fills the grid appropriately with transparent edges only where the subject's shape demands them."
- [ ] T004 [US4] Update the error return in `judgeSprite()` catch block in `eval/judge.js` to set `spatialCoverage: 0` (it was previously set from codeScores). Update the summary console output in `eval/run.js` to list spatialCoverage as LLM-judged (remove it from the `codeBasedDims` array around line 294)

**Checkpoint**: Run eval on 3 prompts. Spatial coverage should have LLM reasoning referencing the subject's shape, not just a percentage.

---

## Phase 3: User Story 1 — Improved Test Prompts (Priority: P1)

**Goal**: Expand prompt set to 30 prompts with richer descriptions, categories, difficulty tiers, colour hints, and expected components

**Independent Test**: Run `node eval/run.js` with the updated prompt set, verify all 30 prompts process, verify category/difficulty appear in the report JSON

- [ ] T005 [US1] Expand `eval/prompt-sets/default.json` from 20 to 30 prompts. Add 10 new prompts distributed across categories: 2 more vehicles, 2 more characters, 2 more tiles, 2 more objects, 2 more creatures. Each new prompt must include: `prompt` (specific visual description with key features and colour hints inline), `width`, `height`, `category`, `hint`, `difficulty` ("simple"/"medium"/"hard"), and optionally `colorHints` and `expectedComponents` fields per data-model.md
- [ ] T006 [US1] Update the existing 20 prompts in `eval/prompt-sets/default.json` to add missing fields: `difficulty` (assign based on subject complexity — tiles/simple objects = "simple", characters/vehicles = "medium", multi-part creatures/equipped characters = "hard"), `colorHints` (optional colour palette suggestions where helpful), and `expectedComponents` (array of expected visual parts for complex subjects)
- [ ] T007 [US1] Update the prompt validation in `loadPromptSet()` in `eval/run.js` (around line 74) to validate the new optional fields: `difficulty` must be one of "simple"/"medium"/"hard" if present, `colorHints` must be a string if present, `expectedComponents` must be an array of strings if present. Don't fail on missing optional fields — only validate when present

**Checkpoint**: Run eval with the expanded 30-prompt set. All prompts should succeed. Report JSON should contain category, difficulty, and new optional fields for each result.

---

## Phase 4: User Story 2 — Appropriate Grid Sizes (Priority: P1)

**Goal**: Configure per-prompt grid dimensions so complex subjects use larger grids

**Independent Test**: Run eval, verify sprites are generated at varied sizes (32x32, 48x48, 64x64), review UI displays them correctly at different sizes

- [ ] T008 [US2] Update grid sizes in `eval/prompt-sets/default.json` per the difficulty-to-size mapping: simple prompts → 32x32, medium prompts → 48x48, hard prompts → 64x64. Adjust width/height fields for each prompt. For side-view vehicles, use width > height (e.g., 64x32 for medium, 96x48 for hard). The eval harness already supports per-prompt dimensions — this is a data-only change
- [ ] T009 [US2] Verify the review UI (`public/js/review.js`) handles mixed canvas sizes correctly. The `renderSprite()` function uses `PIXEL_SCALE = 8` — for 64x64 sprites this produces a 512x512 canvas. If sprites are larger than 48x48, consider reducing PIXEL_SCALE dynamically based on sprite dimensions so the canvas fits comfortably (e.g., scale = Math.min(8, Math.floor(400 / Math.max(width, height)))). Update the canvas sizing logic in `showSprite()` if needed
- [ ] T010 [US2] Verify the comparison page (`public/js/comparison.js`) handles mixed sprite sizes. The `PIXEL_SCALE = 4` constant may need to be dynamic per sprite. Check that sprites of different sizes render at comparable visual sizes in the comparison grid

**Checkpoint**: Run eval, open review.html and comparison.html. Sprites should render at appropriate visual sizes regardless of their grid dimensions.

---

## Phase 5: User Story 3 — Multi-Shot Generation (Priority: P2)

**Goal**: Generate N variants per prompt, auto-select the best, store all in the report

**Independent Test**: Run `node eval/run.js --variants 3`, verify report has 3 variants per prompt with one selected, review UI shows selected variant with option to browse alternatives

- [ ] T011 [US3] Add `--variants` flag to `parseArgs()` in `eval/run.js`. Parse as integer, default to 1, treat 0 as 1. Add it to the args object and include in the console header output
- [ ] T012 [US3] Modify the main eval loop in `runEval()` in `eval/run.js` to support multi-shot generation. When `args.variants > 1`: for each prompt, run the generate→rasterize→stats→judge pipeline N times, collecting each attempt as a `SpriteVariant` object (per data-model.md). Select the variant with the highest `scores.overall`. Promote the selected variant's data (commands, pixels, palette, stats, scores) to the top-level result fields. Store all variants in a `variants` array and set `selectedVariantIndex`. Log each variant's score and highlight the selected one. When `args.variants === 1`: current behaviour unchanged (no variants array in output)
- [ ] T013 [US3] Add `variantsPerPrompt` field to the report metadata in `runEval()` in `eval/run.js` (alongside timestamp, systemPromptVersion, etc.). Only include when variants > 1
- [ ] T014 [US3] Update the review UI (`public/js/review.js`) to handle multi-variant reports. In `showSprite()`: if the current result has a `variants` array, show a variant selector (numbered buttons 1-N) below the canvas. Default to the selected variant. Clicking a variant button swaps the displayed sprite (re-renders canvas, updates scores display, updates stats). Highlight the selected (best) variant button. When no variants array exists, show nothing (backward compatible)
- [ ] T015 [US3] Update the review UI's `nextSprite()` in `public/js/review.js` to always grade the currently displayed variant (which may be a non-selected variant if the user browsed). Store the variant index in the collected scores so human grades can be attributed to specific variants
- [ ] T016 [US3] Update the comparison page (`public/js/comparison.js`) to use the selected variant's data when displaying multi-variant reports. The top-level result fields already contain the selected variant's data, so this should work automatically — verify and fix if needed

**Checkpoint**: Run `node eval/run.js --variants 3`. Report should have variants array with 3 entries per prompt. Review UI should show variant selector. Comparison page should display selected variants.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: End-to-end validation and cleanup

- [ ] T017 Run full end-to-end validation: run eval with expanded 30-prompt set and `--variants 1` (single-shot), verify all prompts succeed at their specified grid sizes, verify spatial coverage is LLM-judged with vision, open review.html and grade at least 10 sprites, verify calibration summary shows all 6 dimensions as LLM/code-based correctly
- [ ] T018 Run multi-shot validation: run eval with `--variants 3` on at least 5 prompts, verify variant selection works, verify review UI variant browsing works, verify comparison page handles the report correctly
- [ ] T019 Backward compatibility check: run `node eval/run.js` with no new flags, verify the report structure is identical to pre-change format (no variants array, same fields), verify review.html and comparison.html work with both old and new report formats

---

## Dependencies & Execution Order

### Phase Dependencies

- **US4 (Phase 2)**: No dependencies — start immediately. Quick change to judge.js
- **US1 (Phase 3)**: No dependencies on US4 — can run in parallel. Prompt set changes only
- **US2 (Phase 4)**: Depends on US1 (needs the updated prompt set with difficulty tiers to assign grid sizes)
- **US3 (Phase 5)**: No dependencies on US1/US2/US4 — modifies run.js and review.js independently. But best done after US4 so spatial coverage is LLM-judged in all variants
- **Polish (Phase 6)**: Depends on all user stories

### Parallel Opportunities

```
T001-T004 (US4: spatial coverage) ──────────────────────
                                                         ├── T017-T019 (Polish)
T005-T007 (US1: prompts) → T008-T010 (US2: grid sizes) ─┤
                                                         │
T011-T016 (US3: multi-shot) ─────────────────────────────┘
```

- US4 and US1 can run fully in parallel (different files)
- US3 can run in parallel with US1+US2 (different files: run.js vs default.json)
- US2 must wait for US1 (needs the prompt set with difficulty tiers)

---

## Implementation Strategy

### MVP First (US4 + US1)

1. Complete US4: Move spatial coverage to LLM-judged (T001-T004)
2. Complete US1: Expand prompt set to 30 (T005-T007)
3. **STOP and VALIDATE**: Run eval, human-grade, verify spatial coverage MAD improves

### Incremental Delivery

1. US4 → spatial coverage calibrated
2. US1 → richer prompts with categories/difficulty
3. US2 → appropriate grid sizes per subject
4. US3 → multi-shot generation (best of N)
5. Polish → end-to-end validation

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story
- US4 is listed first despite being "User Story 4" in the spec because it's a quick judge.js change that unblocks better calibration immediately
- The prompt set expansion (US1) is the most labour-intensive task — writing 10 new high-quality prompts with all metadata fields
- Multi-shot (US3) multiplies generation cost by N but judging is already parallel — expect ~3x generation time for --variants 3
- All existing eval reports remain compatible — no migration needed
