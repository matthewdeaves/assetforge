# Implementation Plan: Judge Vision & Calibration Improvements

**Branch**: `004-judge-vision-calibration` | **Date**: 2026-03-15 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/004-judge-vision-calibration/spec.md`

## Summary

Improve the LLM sprite judge's calibration accuracy by giving it visual context (rendered PNG image + ASCII pixel grid), tightening rubrics with preCheck instructions, parallelising judge LLM calls, adding a pixelArtDiscipline dimension, creating a v2 generation prompt for A/B testing, improving the calibration UI, and syncing review UI rubrics with the judge.

## Technical Context

**Language/Version**: Node.js >=20 (ES2022+, native fetch)
**Primary Dependencies**: express (server), pngjs (new — PNG encoding for vision)
**Storage**: File-system (eval results as JSON)
**Testing**: Manual eval runs + human grading comparison
**Target Platform**: Docker container (linux/amd64)
**Project Type**: CLI eval harness + web service
**Constraints**: OpenRouter API rate limits (~60 req/min), base64 PNG size must be reasonable (<1MB)

## Constitution Check

- **I. LLM-Powered Sprite Generation**: No changes to generation pipeline (except v2 prompt as new file). Compliant.
- **II. Browser Preview**: comparison.html changes are additive. Compliant.
- **V. Docker-First**: pngjs added to package.json, built in container. Compliant.
- **VI. No Scope Creep**: All changes serve the judge calibration pipeline. Compliant.

## Project Structure

### Documentation (this feature)

```text
specs/004-judge-vision-calibration/
├── spec.md              # Feature specification
├── plan.md              # This file
└── tasks.md             # Implementation tasks
```

### Source Code (files touched)

```text
eval/
├── judge.js             # MODIFY: ASCII grid, image vision, rubric preChecks,
│                        #   parallel calls, pixelArtDiscipline dimension
├── run.js               # MODIFY: pass pixels to judgeSprite
├── stats.js             # NO CHANGE
├── png-encoder.js       # NEW: pixel array → 4x-scaled PNG buffer
├── system-prompts/
│   ├── current.js       # NO CHANGE
│   └── v2.js            # NEW: v2 generation prompt
└── results/             # NO CHANGE (output directory)

server/
├── services/
│   └── llm.js           # MODIFY: add callOpenRouterWithImage function
├── routes/
│   └── eval.js          # MODIFY: add /api/rubrics endpoint
└── package.json         # MODIFY: add pngjs dependency

public/
├── comparison.html      # MODIFY: add worst-disagreement section
├── js/
│   ├── comparison.js    # MODIFY: compute + display worst disagreements
│   └── review.js        # MODIFY: fetch rubrics from API instead of hardcoded
```

**Structure Decision**: All changes are within existing directory structure. One new file (`eval/png-encoder.js`), one new file (`eval/system-prompts/v2.js`). No structural changes.

## Review Notes (Code Review Feedback)

These notes were generated from reviewing the suggested improvements against the actual codebase:

### Agreed — High Impact
- **Changes 1+2 (image + ASCII grid)**: Root cause fix. The judge prompt at line 109 of `judge.js` literally says "analyze the drawing commands" — it never sees pixels. `callOpenRouter` in `llm.js` only sends text content blocks. Both changes should ship together.
- **Change 6 (parallelise)**: Trivial one-line change (lines 239-243 of `judge.js`). Do while editing `judge.js` for other changes.

### Agreed — With Caveats
- **Changes 3+4 (rubric tightening)**: The `promptAdherence` rubric is already fairly strong (lines 57-73 have explicit failure modes and the silhouette rule). A `preCheck` data field won't be automatically used by the judge — the fix is to weave pre-check instructions into `buildJudgePrompt()`'s `<instructions>` block (line 108-111), adding a "step 0" before scoring.
- **Change 8 (v2 prompt)**: Fine as a standalone new file. But the specific pixel coordinates ("start at x=2..8") are too rigid — parameterize by grid size. The structural examples are the most valuable part.
- **Change 9 (worst-disagreement UI)**: Easy addition — data is already available in `computeCalibration`.

### Disagreed / Deferred
- **Change 7 (pixelArtDiscipline)**: Premature before the judge can see pixels. The failures described ("incomplete wheels", "just a rectangle") are already captured by `promptAdherence` and `componentSeparation`. Adding a dimension also breaks comparability with existing eval data. **Defer until after re-eval with image vision.**
- **Change 5 (spatialCoverage → LLM)**: MAD 0.89 isn't terrible, and the code-based approach is free and deterministic. **Defer until after Changes 1-4, then reassess.**

### Revised Priority Order
1. Changes 1+2 together (image + ASCII grid — root cause fix)
2. Change 6 (parallelise — trivial, do while editing judge.js)
3. Changes 3+4 (rubric tightening — reworked as instruction changes)
4. Change 9 (worst-disagreement UI — quick, helps guide next grading)
5. Change 8 (v2 system prompt)
6. Change 5 (spatialCoverage — only if MAD doesn't drop after re-eval)
7. Change 7 (pixelArtDiscipline — skip unless gap remains after re-eval)

**Critical gate**: Re-run full eval and collect fresh human scores after items 1-3 before proceeding to items 5+.

## Design Decisions

### D1: PNG Encoding Approach

**Option A**: Use `pngjs` npm package (zero C dependencies, pure JS PNG encoder).
**Option B**: Use canvas/sharp (heavier dependencies, more features).
**Decision**: Option A. `pngjs` is ~50KB, zero-dependency, handles exactly what we need: write RGBA pixels to a PNG buffer. No canvas needed — we just need to scale up palette-indexed pixels to RGBA and encode.

### D2: OpenRouter Vision Format

OpenRouter uses the **OpenAI-compatible** multimodal format:
```json
{
  "role": "user",
  "content": [
    { "type": "text", "text": "..." },
    { "type": "image_url", "image_url": { "url": "data:image/png;base64,..." } }
  ]
}
```

Both `anthropic/claude-opus-4-6` and `anthropic/claude-sonnet-4-6` support vision via OpenRouter. No special headers needed. Confirmed via OpenRouter API docs.

### D3: callOpenRouter Modification

Rather than creating a separate `callOpenRouterWithImage` function, **extend `callOpenRouter`** to accept an optional `imageBase64` parameter. When provided, the user message becomes a content array with text + image blocks. This keeps the API surface small.

```js
async function callOpenRouter(systemPrompt, userMessage, modelOverride, imageBase64)
```

Callers that don't pass `imageBase64` get current text-only behaviour (backward compatible).

### D4: ASCII Grid Character Mapping

- Index 0 (transparent): `·` (middle dot — visually light)
- Indices 1-9: `1`-`9`
- Indices 10-15: `A`-`F`
- Indices 16+: `G`-`Z`, then `a`-`z` (supports up to 62 palette entries)

This gives at-a-glance readability up to 16 colours (hex), which covers 95% of sprites.

### D5: Review UI Rubric Sync

**Option A**: Serve rubrics from a `/api/rubrics` endpoint that reads judge.js's exported `DIMENSION_RUBRICS`.
**Option B**: Build step that copies rubric text.
**Decision**: Option A. The server already serves the review page; adding a JSON endpoint is trivial and guarantees sync at runtime.

### D6: Parallel Judge Calls

Replace the sequential `for` loop (lines 239-243 of judge.js) with:
```js
const llmResults = await Promise.all(
  llmDimensions.map(dim => judgeDimension(dim, ...))
);
```

3 concurrent calls to OpenRouter is well within rate limits. If any call fails, `Promise.all` rejects and the catch block handles it (same as current behaviour).

### D7: v2 Prompt — Perspective Detection

The v2 prompt needs to know the perspective to apply the right rules. The prompt text from `default.json` already includes viewpoint (e.g., "top-down military tank"). The v2 prompt will include rules for ALL perspectives and instruct the LLM to identify which applies based on the prompt text. No parsing needed.

## Complexity Tracking

No constitution violations. All changes are within scope of the eval pipeline.
