# Feature Specification: Judge Vision & Calibration Improvements

**Feature Branch**: `004-judge-vision-calibration`
**Created**: 2026-03-15
**Status**: Draft
**Input**: User description: "Improve LLM sprite judge calibration by giving it visual context (rendered image + ASCII grid), tightening rubrics, adding pixelArtDiscipline dimension, parallelising judge calls, creating v2 generation prompt, and improving calibration UI"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - ASCII Pixel Grid in Judge Prompt (Priority: P1)

As a developer calibrating the sprite judge, I want an ASCII representation of the rendered pixels included in the judge's text prompt, so the judge reasons about actual spatial layout rather than command structure/intent.

**Why this priority**: Zero-dependency, fast to implement, immediately forces the judge to reason about rendered appearance. Can ship and test before the more complex image vision change.

**Independent Test**: Run eval on a single prompt, inspect the judge's user message in debug output, verify the `<rendered_pixels>` block is present and correctly maps palette indices to characters. Compare judge scores with and without ASCII grid.

**Acceptance Scenarios**:

1. **Given** a rasterized sprite with a 12-color palette, **When** the judge evaluates it, **Then** the user message contains a `<rendered_pixels>` block with hex characters (0-F) representing palette indices, with `·` for index 0 (transparent).
2. **Given** a 64x64 sprite, **When** the ASCII grid is generated, **Then** the grid is exactly 64 lines of 64 characters each, matching the pixel array.
3. **Given** the ASCII grid is included, **When** the judge scores promptAdherence, **Then** it references spatial patterns from the grid rather than command descriptions.

---

### User Story 2 - Pass Rendered Sprite Image to Judge (Priority: P1)

As a developer calibrating the sprite judge, I want the judge to see the actual rendered sprite as a PNG image, so it scores based on visual appearance rather than inferring from drawing commands.

**Why this priority**: This is the single highest-impact change — eliminates the root cause of the judge over-scoring (reading command intent vs seeing pixels). Both Opus and Sonnet support vision via OpenRouter.

**Independent Test**: Run eval on a single prompt, verify the LLM request includes a base64 PNG image content block alongside the text. Compare scores with and without image.

**Acceptance Scenarios**:

1. **Given** a rasterized sprite, **When** the judge is called, **Then** the user message includes a base64-encoded PNG image scaled 4x (each pixel becomes a 4x4 block) alongside the text evaluation XML.
2. **Given** the OpenRouter API call, **When** the message is sent, **Then** it uses the OpenAI-compatible multimodal format: `{ type: "image_url", image_url: { url: "data:image/png;base64,..." } }`.
3. **Given** a vision call fails (e.g., model doesn't support vision), **When** the error occurs, **Then** the judge falls back to text-only evaluation (ASCII grid + commands) and logs a warning.

---

### User Story 3 - Tighten promptAdherence Rubric with PreCheck (Priority: P1)

As a developer calibrating the sprite judge, I want a structured pre-check in the promptAdherence rubric that forces the judge to state its first visual impression before scoring, so it can't rationalize a high score from command intent.

**Why this priority**: R5 data shows promptAdherence is the worst dimension (MAD 1.00, 72% agreement, +0.89 bias). The judge consistently over-scores. A preCheck creates a commitment device.

**Independent Test**: Run eval, inspect the judge's promptAdherence response, verify it contains a "first impression" statement before the score.

**Acceptance Scenarios**:

1. **Given** the promptAdherence judge prompt, **When** it is sent to the LLM, **Then** it includes instructions to first write a "first impression" of what the pixels show.
2. **Given** the first impression doesn't match the prompt subject, **When** the judge scores, **Then** the score is explicitly capped at 3 per the rubric instructions.
3. **Given** the score 4 anchor, **When** the judge evaluates, **Then** it requires silhouette match (not just colour match).

---

### User Story 4 - Tighten componentSeparation Rubric with PreCheck (Priority: P2)

As a developer calibrating the sprite judge, I want a structured pre-check in the componentSeparation rubric that forces the judge to verify visible colour boundaries, so it scores rendered separation rather than command-described parts.

**Why this priority**: R5 compSep is currently good (MAD 0.50, 94% agreement) but could regress when the judge starts seeing images. Adding a preCheck defensively ensures consistency.

**Independent Test**: Run eval, inspect compSep response, verify it lists expected parts and confirms visible boundaries.

**Acceptance Scenarios**:

1. **Given** the componentSeparation judge prompt, **When** sent to the LLM, **Then** it includes instructions to list expected parts and verify each has its own visible colour region.
2. **Given** two adjacent parts share the same colour with no boundary, **When** the judge scores, **Then** the score cannot exceed 3.

---

### User Story 5 - Parallel Judge Dimension Calls (Priority: P2)

As a developer running evals, I want the per-dimension LLM judge calls to run in parallel within each sprite, so judging is ~3x faster.

**Why this priority**: Currently each sprite's 3 LLM dimensions are called sequentially. Parallelising saves ~60% of judging time with no functional change.

**Independent Test**: Run eval on 5 prompts, verify total judging time is significantly less than 3x the single-dimension time, and scores are identical to sequential.

**Acceptance Scenarios**:

1. **Given** a sprite with 3 LLM-judged dimensions, **When** the judge runs, **Then** all 3 LLM calls execute concurrently via `Promise.all`.
2. **Given** one LLM dimension call fails, **When** Promise.all rejects, **Then** the error is caught and the sprite is marked `judge-failed` (same as current behaviour).
3. **Given** parallel execution, **When** judging 20 sprites, **Then** total judging time is measurably less than sequential.

---

### User Story 6 - Add pixelArtDiscipline Dimension (Priority: P3 — DEFERRED)

As a developer evaluating sprite quality, I want a 6th scoring dimension that captures pixel art craft quality (clean edges, intentional pixel placement, no artefacts), so failures like "incomplete wheels" and "just a rectangle" are scored.

**Why this priority**: Deferred until after image vision (US-1, US-2) is implemented and re-eval shows whether existing dimensions (promptAdherence, componentSeparation) already capture these failures once the judge can see pixels. Adding a dimension breaks comparability with existing eval data.

**Independent Test**: Run eval, verify the 6th dimension appears in scores and the overall average now uses 6 dimensions.

**Acceptance Scenarios**:

1. **Given** a sprite, **When** the judge runs, **Then** `pixelArtDiscipline` appears in scores alongside the other 5.
2. **Given** a sprite with orphaned stray pixels and unresolved curves, **When** judged on pixelArtDiscipline, **Then** it scores 1-2.
3. **Given** a sprite where every pixel appears intentional with clean edges, **When** judged, **Then** it scores 4-5.
4. **Given** the new dimension, **When** the overall score is computed, **Then** it's the average of all 6 dimensions.

---

### User Story 7 - v2 Generation System Prompt (Priority: P3)

As a developer iterating on sprite quality, I want a v2 generation system prompt with perspective-specific rules and size guidance, so I can A/B test it against the current prompt.

**Why this priority**: This is the end goal — improving sprite quality. Requires calibrated judge first.

**Independent Test**: Run `node eval/run.js --system-prompt v2` and verify sprites are generated with the v2 prompt. Compare scores against `--system-prompt current`.

**Acceptance Scenarios**:

1. **Given** the v2 prompt, **When** a top-down sprite is requested, **Then** the prompt includes top-down perspective rules (show top surface, wheels as thin strips, square footprint).
2. **Given** the v2 prompt, **When** a side-view sprite is requested, **Then** the prompt includes side-view rules (width > height for vehicles, wheels are circles).
3. **Given** the v2 prompt, **When** any sprite is requested, **Then** the prompt includes size guidance (main body starts within 2-8px of edges, fills at least 75% of grid).
4. **Given** `--system-prompt v2`, **When** eval runs, **Then** it loads `eval/system-prompts/v2.js` without affecting `current.js`.

---

### User Story 8 - Worst-Disagreement List in Calibration UI (Priority: P3)

As a developer reviewing calibration, I want the comparison page to show which specific sprites had the worst human/LLM disagreement, so I can prioritise rubric fixes.

**Why this priority**: Nice-to-have diagnostic tool. Currently done manually.

**Independent Test**: Open comparison.html after grading, verify a "Worst Calibration" table appears showing top 5 sprites sorted by total absolute delta.

**Acceptance Scenarios**:

1. **Given** a report with human scores, **When** the comparison page loads, **Then** a "Worst Disagreements" section appears below the calibration metrics.
2. **Given** the worst disagreements table, **When** displayed, **Then** sprites are sorted by total absolute delta across all dimensions (descending).
3. **Given** a per-dimension delta, **When** LLM > human, **Then** the cell is red; **When** LLM < human, **Then** the cell is blue.

---

### User Story 9 - Sync Review UI Rubrics (Priority: P2)

As a developer updating rubrics, I want the review.html grading UI to always use the same rubric text as the judge, so human graders score against the same criteria the LLM uses.

**Why this priority**: review.js has hardcoded rubric text that must be manually kept in sync with judge.js. After rubric changes in US-3 and US-4, plus adding a new dimension in US-6, this sync is critical.

**Independent Test**: Change a rubric in judge.js, reload review.html, verify the updated text appears.

**Acceptance Scenarios**:

1. **Given** rubric text changes in judge.js, **When** review.html is loaded, **Then** the grading UI shows the updated rubric text.
2. **Given** a dimension is added or removed in judge.js, **When** review.html is loaded, **Then** the grading form dynamically reflects the current set of dimensions.

---

### Edge Cases

- What happens when the PNG image is too large for the API? (64x64 @ 4x = 256x256 PNG, well within limits)
- What happens when palette has >16 colours for ASCII grid? (Use hex 0-F for first 16, then A-Z for 17-36)
- What happens when OpenRouter rate-limits parallel calls? (3 concurrent calls is well within limits; if it fails, Promise.all catches and marks sprite as judge-failed)
- What happens when vision is unavailable for a model? (Graceful fallback to text-only with warning log)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST render rasterized pixel grids to ASCII using distinct characters per palette index
- **FR-002**: System MUST render rasterized pixel grids to 4x-scaled PNG buffers in memory
- **FR-003**: System MUST send PNG images to OpenRouter using OpenAI-compatible multimodal content blocks
- **FR-004**: System MUST extend `callOpenRouter` to accept an optional `imageBase64` parameter for multimodal content
- **FR-005**: System MUST include preCheck instructions in promptAdherence and componentSeparation rubrics
- **FR-006**: System MUST run LLM dimension calls in parallel via Promise.all
- **FR-007**: *(DEFERRED — pending re-eval after FR-001 through FR-005)* System SHOULD support a `pixelArtDiscipline` dimension with 1-5 anchors, if existing dimensions do not capture pixel art craft failures after judge has visual context
- **FR-008**: System MUST provide a v2 system prompt at `eval/system-prompts/v2.js`
- **FR-009**: System MUST show worst-disagreement list in comparison.html
- **FR-010**: System MUST keep review.js rubric text in sync with judge.js (either via API endpoint or build step)

### Key Entities

- **Dimension Rubric**: name, description, anchors (1-5), method (code/llm). Pre-check logic is embedded in `buildJudgePrompt()` instruction template, not as a data field.
- **Judge Result**: per-dimension score + reasoning, overall average
- **ASCII Grid**: text representation of pixel array, palette-indexed
- **Sprite Image**: 4x-scaled PNG buffer for vision

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After implementing US-1 through US-4, re-run eval + human grading: promptAdherence MAD < 0.80 (currently 1.00)
- **SC-002**: After implementing US-1 through US-4: all 5 dimensions agreement > 80% (promptAdherence currently 72%)
- **SC-003**: Parallel judge calls reduce per-sprite judging time by >40%
- **SC-004**: v2 system prompt produces overall score improvement of >=0.3 points (on 1-5 scale) compared to current prompt across the same 20-prompt set, judged by calibrated judge
