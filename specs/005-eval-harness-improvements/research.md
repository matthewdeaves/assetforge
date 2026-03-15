# Research: Eval Harness Improvements

## R-001: Prompt Set Structure

**Decision**: Extend the existing `default.json` format with optional fields for `difficulty`, `colorHints`, and `expectedComponents`. Keep backward compatibility — existing fields (`prompt`, `width`, `height`, `category`, `hint`) remain unchanged.

**Rationale**: The current prompt set already has `category` and `hint` fields plus per-prompt `width`/`height`. Adding optional fields preserves compatibility with any tooling that reads the prompt set. The eval harness already iterates over `prompts` array entries and passes through whatever fields exist.

**Alternatives considered**:
- New prompt set file format: Unnecessary — the existing structure is flexible enough
- Separate metadata file: Adds complexity for no benefit — keep everything in one JSON

## R-002: Grid Size Strategy

**Decision**: Use three grid size tiers based on subject complexity:
- 32x32: Simple objects (tiles, crates, potions, keys, barrels, boulders)
- 48x48: Medium complexity (characters, small vehicles, trees)
- 64x64: Complex subjects (large vehicles, creatures with multiple parts, detailed characters with equipment)

**Rationale**: The current prompt set already uses mixed sizes (32x32 and 64x64) — the eval harness handles this correctly. Adding 48x48 as a middle tier gives a step between "simple" and "complex" without jumping straight to 4x the pixel count. Characters at 32x32 were scoring low on component separation because parts couldn't be visually distinguished at that resolution.

**Alternatives considered**:
- All 64x64: Wastes generation time on simple subjects (tiles don't benefit from more pixels)
- Per-category fixed sizes: Too rigid — some characters are simple (skeleton) while others are complex (knight with equipment)

## R-003: Multi-Shot Variant Storage

**Decision**: Store variants as an array on each result entry in the report. The `result` object gains a `variants` array (when N>1) and a `selectedVariantIndex` field. For backward compatibility, when N=1, the result structure is identical to current (no `variants` array).

**Rationale**: Keeping variants in the same report file means the review UI can access them without additional API calls. The selected variant's data is promoted to the top-level fields (pixels, commands, scores) so existing code that reads reports continues to work. The `variants` array is supplementary data for analysis.

**Alternatives considered**:
- Separate file per variant: Too many files, harder to analyze
- Flatten all variants as separate results: Breaks the 1:1 prompt-to-result mapping that the review UI depends on

## R-004: Spatial Coverage Rubric Update

**Decision**: Move `spatialCoverage` from `computeCodeBasedScores()` to the `llmDimensions` array. Update the rubric description to instruct the judge to consider the subject's natural shape. Keep the code-based coverage percentage in `pixel_statistics` as context.

**Rationale**: The code-based approach has the worst calibration (MAD 0.95, 68% agreement). The LLM judge, with vision, can see whether a round boulder at 60% coverage is appropriate while a bus at 60% is too small. All other LLM-judged dimensions are under 0.85 MAD.

**Alternatives considered**:
- Hybrid approach (code gives hint, LLM adjusts): Adds complexity. The LLM already receives pixel statistics including coverage percentage — it can use that as context naturally.
- Remove the dimension entirely: Spatial coverage is still a meaningful quality signal, just needs better measurement.

## R-005: Review UI Variant Browsing

**Decision**: Add a simple variant selector (numbered buttons or dropdown) to the review UI that appears when a report has multi-shot data. Default to showing the selected (best) variant. Clicking a variant button swaps the displayed sprite, scores, and stats.

**Rationale**: The review UI already renders one sprite at a time. Swapping which variant is displayed is a minimal change — just update the data source for the current sprite's rendering. No layout changes needed.

**Alternatives considered**:
- Side-by-side comparison of all variants: Too space-intensive for 3+ variants, and the grading flow is one-at-a-time
- Separate "variants" page: Over-engineered for a dev tool
