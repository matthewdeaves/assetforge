# Research: Judge Vision & Calibration Improvements

## R-001: Root Cause of Judge Over-Scoring

**Decision**: The judge over-scores because it reads drawing command JSON and understands *intent* — it knows a sequence of rects is building a car. A human only sees rendered pixels. The fix is giving the judge visual context.

**Rationale**: Calibration data from 19 human-scored sprites shows MAD of 1.11 for promptAdherence (LLM over-scores 11/19) and 1.05 for componentSeparation (LLM over-scores 14/19). The sports car with incomplete wheels got LLM=5/Human=2 on componentSeparation. The pickup truck that was "just a rectangle" got LLM=4/Human=1 on promptAdherence.

**Alternatives considered**:
- Rubric tightening alone: insufficient — the existing promptAdherence rubric already has strong silhouette language (lines 57-73 of judge.js) but the judge still over-scores because it never sees the pixels
- Removing drawing commands from judge prompt entirely: loses useful context about layer ordering and intent

## R-002: OpenRouter Vision API Format

**Decision**: Use OpenAI-compatible multimodal content blocks with base64 PNG inline.

**Rationale**: OpenRouter proxies to Anthropic models using the OpenAI-compatible format. Both `anthropic/claude-opus-4-6` and `anthropic/claude-sonnet-4-6` support vision. The format is:
```json
{
  "role": "user",
  "content": [
    { "type": "text", "text": "..." },
    { "type": "image_url", "image_url": { "url": "data:image/png;base64,..." } }
  ]
}
```

**Alternatives considered**:
- URL-based image hosting: requires a public URL or presigned URL — unnecessary complexity for a local tool
- Anthropic native API format: would require switching from OpenRouter

## R-003: PNG Encoding Library

**Decision**: Use `pngjs` (pure JS, zero native dependencies).

**Rationale**: Only need to write RGBA pixels to a PNG buffer. `pngjs` is ~50KB, well-maintained, handles this exactly. A 64x64 sprite at 4x scale = 256x256 RGBA PNG ≈ 5-15KB base64, well within API limits.

**Alternatives considered**:
- `sharp`: Heavy native dependency (libvips), overkill for simple PNG encoding
- `canvas` (node-canvas): Requires Cairo native build, unnecessary since we're writing pixels not drawing shapes
- Manual PNG encoding: Possible but error-prone, not worth it when pngjs exists

## R-004: PreCheck Implementation Approach

**Decision**: Weave pre-check instructions into `buildJudgePrompt()`'s `<instructions>` block as a "step 0", not as a data field on the rubric object.

**Rationale**: Adding a `preCheck` field to `DIMENSION_RUBRICS` won't cause the judge to use it — the field needs to appear in the actual prompt text sent to the LLM. The `<instructions>` block (line 108-111 of judge.js) is where the judge receives its workflow steps. Adding a step 0 ("write your first impression before scoring") creates a commitment device that prevents score rationalization.

**Alternatives considered**:
- Data field on rubric + template rendering: More complex, same result, adds indirection
- Separate system prompt for biased dimensions: Would require per-dimension prompt builders — over-engineered

## R-005: pixelArtDiscipline Dimension Timing

**Decision**: Defer until after image vision is implemented and re-eval shows whether existing dimensions capture craft failures.

**Rationale**: The failures motivating this dimension ("incomplete wheels", "just a rectangle") are symptoms of the judge not seeing pixels, not a missing dimension. `promptAdherence` and `componentSeparation` should capture these once the judge has visual context. Adding a 6th dimension also breaks comparability with all existing eval data and changes the overall score formula.

**Alternatives considered**:
- Implement immediately: Risk of adding unnecessary complexity before the root cause is fixed
- Replace an existing dimension: Would lose continuity with existing calibration data

## R-006: spatialCoverage Scoring Method

**Decision**: Keep as code-based for now. Reassess after image vision changes.

**Rationale**: Current MAD of 0.89 is tolerable. The code-based approach is free, deterministic, and reproducible. The LLM-judged colorUsage has MAD 0.58, but moving spatialCoverage to LLM won't necessarily achieve the same — the benefit depends on whether "appropriateness for subject" matters more than raw coverage percentage. Wait for post-vision calibration data.

**Alternatives considered**:
- Move to LLM immediately: Adds cost and latency for uncertain benefit
- Hybrid (code hint + LLM override): Promising but should wait for calibration data to justify
