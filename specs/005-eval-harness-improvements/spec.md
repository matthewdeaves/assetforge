# Feature Specification: Eval Harness Improvements

**Feature Branch**: `005-eval-harness-improvements`
**Created**: 2026-03-15
**Status**: Draft
**Input**: Calibration findings from 4 rounds of human grading across 3 generation prompt versions

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Improved Test Prompts with Richer Descriptions (Priority: P1)

A developer updating the eval prompt set writes more specific test prompts that include key visual features, colour hints, expected components, category tags, and difficulty tiers. The prompt set expands from 20 to 30 prompts. When the eval runs, the richer prompts give the generation model clearer targets, and the category/difficulty metadata enables per-category analysis of judge calibration and generation quality.

**Why this priority**: The test prompts are the input to everything else. Vague prompts produce ambiguous sprites that are hard to judge consistently. The worst-performing sprites (dragon at 2.8, pickup truck at 3.2) correlate with the least specific prompts. Better prompts improve both generation quality and calibration signal strength.

**Independent Test**: Update the prompt set JSON file, run an eval, verify that category tags appear in the report, and confirm that per-category score breakdowns can be computed from the results.

**Acceptance Scenarios**:

1. **Given** the updated prompt set, **When** a developer runs the eval, **Then** all 30 prompts are processed and each result includes the prompt's category and difficulty tier in the report.
2. **Given** prompts with colour palette hints, **When** the generation model produces sprites, **Then** the generated palettes tend to reflect the suggested colours (verified by human review, not enforced).
3. **Given** prompts with expected component lists, **When** the judge scores prompt adherence, **Then** the judge can reference specific expected components in its reasoning.
4. **Given** a completed eval report, **When** a developer reviews the results, **Then** they can filter or group scores by category (vehicle, character, tile, object, creature) and difficulty tier (simple, medium, hard).

---

### User Story 2 - Appropriate Grid Sizes for Each Subject (Priority: P1)

A developer configures per-prompt grid dimensions in the prompt set so that complex subjects (creatures, characters with equipment) use larger grids (48x48 or 64x64) while simple objects (tiles, crates, keys) stay at 32x32. The eval harness already supports per-prompt width/height — this is purely a prompt set data change.

**Why this priority**: Some subjects physically cannot resolve at 32x32 pixels. A dragon with wings spread needs more pixels than a simple ground tile. The current uniform grid size forces the generation model to compromise on complex subjects, producing blobs instead of identifiable sprites.

**Independent Test**: Update the prompt set with varied grid sizes, run an eval, verify that sprites are generated at the specified dimensions and that the judge correctly evaluates them at their native size.

**Acceptance Scenarios**:

1. **Given** prompts with different grid sizes (32x32, 48x48, 64x64), **When** the eval runs, **Then** each sprite is generated and rasterized at the size specified in its prompt.
2. **Given** a complex subject on a 64x64 grid, **When** compared to the same subject at 32x32, **Then** the larger grid version has more identifiable components (verified by human review).
3. **Given** a simple subject (ground tile) at 32x32, **When** evaluated, **Then** quality is not degraded — simple subjects do not need larger grids.

---

### User Story 3 - Multi-Shot Generation (Best of N) (Priority: P2)

A developer runs the eval with a `--variants N` flag. For each prompt, the harness generates N sprite variants, judges all of them, and selects the one with the highest overall judge score. The report stores all variants (for analysis) and marks which was selected. The human review UI shows the selected variant by default with the option to browse all variants for a given prompt.

**Why this priority**: Single-shot generation is a lottery — quality varies significantly between runs for the same prompt. Generating multiple variants and picking the best is how real game art pipelines work. This captures the model's best output rather than a random sample.

**Independent Test**: Run the eval with `--variants 3`, verify that the report contains 3 variants per prompt, one is marked as selected, and the review UI shows the selected variant by default.

**Acceptance Scenarios**:

1. **Given** a `--variants 3` flag, **When** the eval runs, **Then** each prompt produces 3 sprite variants, each with its own pixel data, commands, and judge scores.
2. **Given** 3 variants for a prompt, **When** the harness selects the best, **Then** the variant with the highest overall judge score is marked as selected.
3. **Given** a completed multi-variant report, **When** a developer opens the review UI, **Then** the selected (best) variant is shown by default for each prompt.
4. **Given** a completed multi-variant report, **When** a developer wants to inspect alternatives, **Then** they can browse all variants for any prompt and see their individual scores.
5. **Given** `--variants 1` (or no flag), **When** the eval runs, **Then** behaviour is identical to the current single-shot mode — full backward compatibility.

---

### User Story 4 - LLM-Judged Spatial Coverage (Priority: P1)

The spatial coverage dimension moves from code-based (deterministic pixel count) to LLM-judged (with vision). The judge evaluates whether the sprite's coverage is appropriate for the subject's natural shape rather than applying fixed percentage thresholds. The code-based coverage percentage remains available as supplementary context in the pixel statistics.

**Why this priority**: Spatial coverage is the worst-calibrated dimension (MAD 0.95, 68% agreement) because the code measures raw pixel fill while humans judge whether coverage suits the subject. A round boulder at 60% coverage is fine; a bus at 60% is too small. The LLM judge, now that it has vision, can make this contextual assessment.

**Independent Test**: Run an eval, verify that spatial coverage is scored by the LLM (not code), confirm the raw coverage percentage still appears in pixel statistics, and compare calibration against a human grading session.

**Acceptance Scenarios**:

1. **Given** the updated judge, **When** a sprite is evaluated, **Then** spatial coverage is scored by the LLM with reasoning that references the subject's natural shape and the rendered pixels.
2. **Given** a round object (boulder) at 60% pixel coverage, **When** the judge scores spatial coverage, **Then** the score reflects that 60% is appropriate for a round object on a square grid (not penalized for empty corners).
3. **Given** the code-based coverage percentage, **When** the LLM judges spatial coverage, **Then** the percentage is available as supplementary context but does not determine the score.
4. **Given** 20+ human-graded sprites, **When** calibration is computed for spatial coverage, **Then** MAD is below 0.85 (improved from current 0.95).

---

### Edge Cases

- What happens when `--variants 0` is passed? Treat as 1 (minimum one variant).
- What happens when all N variants for a prompt fail generation? Mark the prompt as failed in the report (same as current single-shot failure behaviour).
- What happens when a prompt has no category or difficulty tag? Default to category "uncategorized" and difficulty "medium".
- What happens when a 64x64 prompt is evaluated alongside 32x32 prompts in the same report? The report stores per-prompt dimensions — the review UI and comparison page handle mixed sizes gracefully.
- What happens when the LLM judge gives spatial coverage a high score but pixel coverage is very low (e.g., 15%)? This is valid — a thin key or sword should have low pixel coverage but good spatial coverage if it fills its natural shape well.
- What happens when `--variants` is used with an existing report that has single-shot data? Reports from different runs are independent files — no compatibility issue.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The prompt set MUST contain at least 30 test prompts spanning five categories: vehicle, character, tile, object, and creature.
- **FR-002**: Each prompt MUST include fields for: prompt text, width, height, category, and difficulty (simple/medium/hard). Colour hints and expected components are optional fields.
- **FR-003**: The eval report MUST include category and difficulty metadata from each prompt in its results, enabling per-category analysis.
- **FR-004**: Per-prompt grid dimensions MUST be respected by the generation, rasterization, and judging pipeline — each sprite is processed at its specified size.
- **FR-005**: The eval harness MUST accept a `--variants N` command-line flag specifying how many generation attempts per prompt (default: 1).
- **FR-006**: When `--variants` is greater than 1, the harness MUST generate N sprites per prompt, judge all of them, and select the variant with the highest overall judge score.
- **FR-007**: The eval report MUST store all variants for each prompt (pixel data, commands, scores) and indicate which variant was selected.
- **FR-008**: The human review UI MUST display the selected variant by default and provide a way to view all variants for a given prompt.
- **FR-009**: Spatial coverage MUST be evaluated by the LLM judge (with vision) instead of deterministic code-based thresholds.
- **FR-010**: The spatial coverage rubric MUST instruct the judge to consider whether coverage is appropriate for the subject's natural shape.
- **FR-011**: The code-based coverage percentage MUST remain in pixel statistics as supplementary context available to the judge.
- **FR-012**: When `--variants 1` or no flag is provided, the harness MUST behave identically to the current single-shot mode — existing reports remain compatible.

### Key Entities

- **TestPrompt**: A prompt entry with text, dimensions (width/height), category, difficulty tier, and optional colour hints and expected component list.
- **SpriteVariant**: A single generation attempt for a prompt — contains commands, pixel data, palette, stats, and judge scores. In multi-shot mode, multiple variants exist per prompt.
- **SelectedVariant**: The variant chosen as the best for a prompt, marked in the report with the selection reason (highest overall score).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The expanded prompt set contains 30 prompts across all 5 categories with at least 3 prompts per category.
- **SC-002**: Complex subjects (creatures, characters with equipment) generate on grids of 48x48 or 64x64 and produce more identifiable sprites than on 32x32 (verified by human review of at least 5 comparison pairs).
- **SC-003**: Multi-shot generation with `--variants 3` produces a selected variant that scores at least 0.3 points higher (overall) than the average of the rejected variants, across the full prompt set.
- **SC-004**: LLM-judged spatial coverage achieves MAD below 0.85 and agreement rate above 75% when calibrated against human grading of 20+ sprites (improved from current MAD 0.95, 68% agreement).
- **SC-005**: The overall human-scored quality average across all prompts improves by at least 0.2 points compared to the Round 4 baseline (current overall: 4.13) when using the expanded prompt set with appropriate grid sizes.
- **SC-006**: Backward compatibility — running the eval with no new flags produces a report identical in structure to current reports.
