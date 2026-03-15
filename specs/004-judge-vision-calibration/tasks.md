# Tasks: Judge Vision & Calibration Improvements

**Input**: Design documents from `/specs/004-judge-vision-calibration/`
**Prerequisites**: plan.md (required), spec.md (required for user stories)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add pngjs dependency and prepare shared utilities

- [X] T001 [US2] Install pngjs dependency — run `npm install pngjs` in `server/` directory, verify it appears in `server/package.json`. Note: `eval/png-encoder.js` will require pngjs via relative path `require('../server/node_modules/pngjs')` or ensure node_modules resolution works from eval/ (test with `node -e "require('pngjs')"` from eval/ directory).

**Checkpoint**: pngjs available for import

---

## Phase 2: Core Judge Improvements (Blocking)

**Purpose**: ASCII grid, image vision, and LLM API changes — these are prerequisites for rubric changes and the new dimension

### T002 — ASCII Pixel Grid Function [US1]

- [X] T002 [US1] Add `pixelsToAscii(pixels)` function in `eval/judge.js`
  - Input: 2D pixel array (number[][])
  - Output: string with one line per row, characters mapped from palette index
  - Character mapping: index 0 → `·`, indices 1-9 → `1`-`9`, 10-15 → `A`-`F`, 16+ → `G`-`Z` then `a`-`z`
  - Export from module for testing

### T003 — Include ASCII Grid in Judge User Message [US1]

- [X] T003 [US1] Modify `buildUserMessage()` in `eval/judge.js` to accept `pixels` parameter and include `<rendered_pixels>` block
  - Add `pixels` parameter after `height`
  - Call `pixelsToAscii(pixels)` and insert as `<rendered_pixels>` block between `</pixel_statistics>` and `<drawing_commands>`
  - Update `judgeSprite()` signature to accept `pixels` and pass through to `buildUserMessage()`

### T004 — Update run.js to Pass Pixels to Judge [US1]

- [X] T004 [US1] Modify `eval/run.js` line ~235: pass `result.pixels` and `result.palette` to `judgeSprite()` call
  - Current: `judgeSprite(testPrompt.prompt, result.commands, result.stats, testPrompt.hint || null, judgeModel, testPrompt.width, testPrompt.height)`
  - New: add `result.pixels` and `result.palette` parameters (position per updated signature in data-model.md)
  - Both are needed: `pixels` for ASCII grid (T003), `palette` for PNG rendering (T007)

### T005 — PNG Encoder Module [US2]

- [X] T005 [P] [US2] Create `eval/png-encoder.js` — converts pixel array + palette to 4x-scaled PNG buffer
  - Function: `renderToPNG(pixels, palette, scale = 4)` → returns `Buffer` (PNG data)
  - Uses `pngjs` to create PNG: for each pixel, look up palette colour, write RGBA (index 0 = fully transparent)
  - Scale: each logical pixel becomes `scale × scale` real pixels
  - Export: `{ renderToPNG }`

### T006 — Extend callOpenRouter for Vision [US2]

- [X] T006 [P] [US2] Modify `callOpenRouter()` in `server/services/llm.js` to accept optional `imageBase64` parameter
  - New signature: `async function callOpenRouter(systemPrompt, userMessage, modelOverride, imageBase64)`
  - When `imageBase64` is provided: set user message `content` to array:
    ```js
    [
      { type: "text", text: userMessage },
      { type: "image_url", image_url: { url: `data:image/png;base64,${imageBase64}` } }
    ]
    ```
  - When `imageBase64` is not provided: current behaviour (string content)
  - Backward compatible — all existing callers pass no 4th argument

### T007 — Pass Image to Judge Dimensions [US2]

- [X] T007 [US2] Modify judge pipeline in `eval/judge.js` to render PNG and pass to LLM (depends on T005, T006)
  - In `judgeSprite()`: call `renderToPNG(pixels, palette)` to get PNG buffer, convert to base64
  - Modify `judgeDimension()` to accept `imageBase64` parameter and pass to `callOpenRouter()`
  - Update `buildJudgePrompt()` instructions (line ~109): change "analyze the drawing commands" to "analyze the rendered sprite image and drawing commands"
  - Add fallback: if PNG rendering fails, log warning and continue text-only

**Checkpoint**: Judge now sees both the ASCII grid AND the rendered sprite image for every dimension call. Run eval on 2-3 prompts to verify.

---

## Phase 3: Rubric Tightening

**Purpose**: Add preCheck instructions to promptAdherence and componentSeparation

### T008 — promptAdherence preCheck [US3]

- [X] T008 [P] [US3] Tighten promptAdherence rubric in `eval/judge.js`
  - Modify `buildJudgePrompt(dimension)` — add conditional logic: when `dimension === 'promptAdherence'`, inject step 0 into `<instructions>`:
    ```
    0. FIRST IMPRESSION: Look at the rendered sprite image (or ASCII grid). Write what you honestly see:
       "Looking at these pixels with no context, I see: [description]."
       If your first impression does not match the prompt subject, the score CANNOT exceed 3.
    ```
  - `buildJudgePrompt` already receives `dimension` as its parameter (line ~91), so add a conditional block before the instructions template
  - Tighten score 4 anchor in `DIMENSION_RUBRICS.promptAdherence.anchors[4]`: require silhouette match, not just colour match
  - Note: Do NOT add a `preCheck` data field — the judge won't automatically use it. The fix goes in the instruction template.

### T009 — componentSeparation preCheck [US4]

- [X] T009 [P] [US4] Tighten componentSeparation rubric in `eval/judge.js`
  - Modify `buildJudgePrompt(dimension)` — add conditional logic: when `dimension === 'componentSeparation'`, inject step 0 into `<instructions>`:
    ```
    0. PART INVENTORY: Identify how many distinct parts the subject should have.
       For each expected part, verify it has its OWN visible colour region in the rendered pixels.
       If adjacent parts share the same colour with no visible boundary, the score CANNOT exceed 3.
    ```
  - Same approach as T008 — conditional in `buildJudgePrompt`, not a data field on the rubric.

**Checkpoint**: Rubrics tightened. Run eval on 5 prompts and inspect judge reasoning to verify preChecks appear.

---

## Phase 4: Parallel Judge Calls [US5]

### T010 — Parallelise LLM Dimension Calls [US5]

- [X] T010 [US5] Replace sequential for loop in `judgeSprite()` (eval/judge.js, lines 239-243) with `Promise.all`
  - Current:
    ```js
    for (const dim of llmDimensions) {
      const result = await judgeDimension(dim, ...);
      scores[dim] = result.score;
      scores[`${dim}Reasoning`] = result.reasoning;
    }
    ```
  - New:
    ```js
    const llmResults = await Promise.all(
      llmDimensions.map(dim => judgeDimension(dim, prompt, commands, stats, hint, width, height, judgeModel, imageBase64))
    );
    llmDimensions.forEach((dim, i) => {
      scores[dim] = llmResults[i].score;
      scores[`${dim}Reasoning`] = llmResults[i].reasoning;
    });
    ```
  - Error handling: wrap in try/catch (already exists), `Promise.all` will reject on first failure

**Checkpoint**: Run eval on 5 prompts, verify judging is faster and scores are correct.

---

## Phase 5: New Dimension — pixelArtDiscipline [US6]

### T011 — Add pixelArtDiscipline Rubric [US6]

- [X] T011 [US6] Add `pixelArtDiscipline` to `DIMENSION_RUBRICS` in `eval/judge.js`
  - Name: "Pixel Art Discipline"
  - Description: "Does the sprite follow pixel art conventions? Evaluate edge quality, intentionality of pixel placement, and absence of artefacts."
  - Anchors:
    ```
    1: Smooth gradients, blurry edges, shapes that require higher resolution to read. Anti-aliased curves from circle renderer visible throughout.
    2: Several orphaned stray pixels, unintentional blurring on curves. Shapes attempted but don't resolve cleanly at this resolution.
    3: Mostly follows conventions but 2-3 areas with poorly resolved edges or stray pixels breaking the silhouette.
    4: Shapes read cleanly, edges appear intentional, minimal stray pixels. Curves are properly stepped.
    5: Every pixel placement appears intentional. Curves properly stepped, no artefacts, clean silhouette, no orphaned pixels.
    ```

### T012 — Wire pixelArtDiscipline into Judge Pipeline [US6]

- [X] T012 [US6] Add `pixelArtDiscipline` to `llmDimensions` array in `judgeSprite()` (eval/judge.js)
  - Add `'pixelArtDiscipline'` to the `llmDimensions` array (it will be included in the Promise.all automatically)
  - Update overall score computation: `DIMENSIONS.length` will be 6 now (automatic via `Object.keys(DIMENSION_RUBRICS)`)
  - Verify `DIMENSIONS` array includes the new key

### T013 — Update Human Review UI for 6th Dimension [US6, US9] — DEFERRED with US-6

- [X] T013 [US6] **DEFERRED** — Update `public/js/review.js` to handle 6 dimensions
  - Only needed if pixelArtDiscipline (US-6) is implemented after re-eval gate
  - The rubric text will be fetched from API (see T018), so the UI will dynamically render whatever dimensions exist
  - With T018 complete, this task may be unnecessary — verify after T018

**Checkpoint**: If US-6 proceeds: run eval, verify 6 dimensions scored, overall is average of 6.

---

## Phase 6: v2 Generation System Prompt [US7]

### T014 — Create v2 System Prompt [US7]

- [X] T014 [P] [US7] Create `eval/system-prompts/v2.js`
  - Export `buildSystemPrompt(width, height)` (same interface as current.js)
  - Include everything from current.js PLUS:
  - **Perspective rules section**:
    - `top-down`: Show top surface only. Wheels/tracks as thin strips at edges, not circles. Square footprint. Camera looks straight down.
    - `side-view`: Width >> Height for vehicles. Wheels are circles touching bottom edge. Profile matches real silhouette.
    - `front-facing`: Roughly symmetric left-right. Head at top, feet at bottom. Arms extend sideways.
    - `three-quarter`: Combine top and side — show top surface receding, with one visible side face. NOT isometric.
  - **Size/position guidance**:
    - Start the main body rect at x=2..4, y=2..4 and extend to within 2-4px of the far edge.
    - On a 64x64 grid, the main body should be at least 48x48px. On 32x32, at least 24x24px.
    - Draw the largest shape first; add sub-components relative to that anchor. Never let sub-components float disconnected.
  - **Structural examples** (annotated, not full command arrays):
    - Top-down vehicle: hull rect → track rects left/right → turret circle → barrel rect
    - Front-facing humanoid: head circle → body rect → arm rects left/right → leg rects
    - Side-view vehicle: body rect (wide) → wheel circles bottom → window rect upper → bumper details
  - Instruct: "Identify the perspective from the prompt (top-down, side-view, front-facing, three-quarter) and apply the matching rules."

**Checkpoint**: Run `node eval/run.js --system-prompt v2` on 3 prompts, verify sprites generate.

---

## Phase 7: UI Improvements [US8, US9]

### T015 — Worst-Disagreement List [US8]

- [X] T015 [P] [US8] Add worst-disagreement table to `public/js/comparison.js`
  - After computing per-sprite calibration, sort sprites by total absolute delta (sum of |human - llm| across all dimensions)
  - Extract top 5 worst disagreements
  - Build HTML table with columns: Prompt (truncated), and per-dimension delta (coloured: red if LLM > human, blue if LLM < human), total delta
  - Insert table into the comparison page

### T016 — Add Worst-Disagreement HTML Section [US8]

- [X] T016 [P] [US8] Add `<section id="worst-disagreements">` to `public/comparison.html`
  - Place after the calibration evolution table
  - Header: "Worst Calibration Disagreements"
  - Container div for JS to populate
  - Minimal CSS for red/blue delta colours

### T017 — Rubric API Endpoint [US9]

- [X] T017 [P] [US9] Add `GET /api/rubrics` endpoint in `server/routes/eval.js`
  - Import `DIMENSION_RUBRICS` from `eval/judge.js`
  - Return JSON: `{ dimensions: DIMENSION_RUBRICS }`
  - This allows review.js to fetch rubrics at runtime

### T018 — Fetch Rubrics in Review UI [US9]

- [X] T018 [US9] Modify `public/js/review.js` to fetch rubrics from `/api/rubrics` instead of hardcoded text (depends on T017)
  - On page load, fetch `/api/rubrics`
  - Replace hardcoded `RUBRICS` object with fetched data
  - Build dimension scoring UI dynamically from fetched rubric names, descriptions, and anchors
  - Remove the hardcoded rubric text (lines ~7-63)

**Checkpoint**: All UI improvements complete. Load comparison.html and review.html, verify new features work.

---

## Phase 8: Validation & Cleanup

### T019 — End-to-End Eval Run [ALL]

- [X] T019 Run full eval with all changes: `node eval/run.js --system-prompt current`
  - Verify: 5 dimensions scored per sprite (6 only if US-6 was implemented)
  - Verify: judge sees image (check log output for base64 image size)
  - Verify: ASCII grid in judge messages
  - Verify: parallel judging is faster
  - Verify: scores file has all expected dimensions

### T020 — Update comparison.js for 6 Dimensions [US6] — DEFERRED with US-6

- [X] T020 [US6] **DEFERRED** — Update `public/js/comparison.js` to handle 6 dimensions in calibration table
  - Only needed if pixelArtDiscipline (US-6) is implemented after re-eval gate
  - The `DIMENSIONS` array in comparison.js must include `pixelArtDiscipline`
  - Table headers and rows must accommodate the 6th dimension

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — T001 first
- **Phase 2 (Core)**: T002→T003→T004 (sequential, same file). T005, T006 parallel with T002-T004. T007 depends on T003+T005+T006
- **Phase 3 (Rubrics)**: T008, T009 parallel. Depend on T003 (judge sees pixels now)
- **Phase 4 (Parallel)**: T010 depends on T007 (needs updated judgeDimension signature)
- **Phase 5 (Dimension)**: T011→T012→T013 sequential. Depends on T010
- **Phase 6 (v2 Prompt)**: T014 independent of all other tasks (new file)
- **Phase 7 (UI)**: T015+T016 parallel, T017+T018 sequential. All independent of eval changes
- **Phase 8 (Validation)**: T019, T020 after all other tasks

### Parallel Opportunities

```
T001 ─────────────────────────────────────────────────────────────────────
  │
  ├── T002 → T003 → T004 ──┐
  │                         ├── T007 → T010 → T011 → T012 → T013
  ├── T005 ─────────────────┤
  ├── T006 ─────────────────┘
  │
  ├── T008 (after T003) ────── (parallel with T009)
  ├── T009 (after T003) ────── (parallel with T008)
  │
  ├── T014 ──────────────────── (independent, any time)
  │
  ├── T015 + T016 ───────────── (parallel, independent)
  ├── T017 → T018 ───────────── (sequential)
  │
  └── T019, T020 ────────────── (final validation)
```

### Implementation Strategy

**MVP First**: T001→T002→T003→T004→T005→T006→T007 (ASCII grid + image vision working)
Then: T008+T009 (rubric tightening) → Run eval + human grade → check if MAD drops
Then: T010 (parallel) → T011→T012→T013 (new dimension) → T014 (v2 prompt)
Then: T015-T018 (UI) → T019-T020 (validation)

---

## Notes

- [P] tasks = different files, no dependencies
- After Phase 3 completion, run eval + collect human scores to measure calibration improvement before proceeding
- The v2 prompt (T014) can be written at any time — it's a standalone new file
- pngjs is the only new dependency; it's zero-dependency itself (~50KB)
- All OpenRouter vision calls use the same endpoint, no API changes needed
