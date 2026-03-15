# Data Model: Eval Harness Improvements

## Modified Entities

### TestPrompt (eval/prompt-sets/default.json) — extended

```
TestPrompt
├── prompt: string                    # Generation prompt text (existing)
├── width: integer                    # Grid width in pixels (existing)
├── height: integer                   # Grid height in pixels (existing)
├── category: string                  # One of: vehicle, character, tile, object, creature (existing)
├── hint: string | null               # Quality hint for the judge (existing)
├── difficulty: string                # NEW: "simple", "medium", or "hard"
├── colorHints: string | null         # NEW: optional palette colour suggestions
└── expectedComponents: string[] | null  # NEW: optional list of expected visual parts
```

### EvalResult (eval report JSON) — extended for multi-shot

```
EvalResult (single-shot, N=1 — identical to current)
├── prompt: TestPrompt
├── status: "success" | "generation-failed" | "judge-failed"
├── commands: DrawingCommand[] | null
├── pixels: integer[][] | null
├── palette: Color[] | null
├── stats: PixelStats | null
├── scores: QualityScore | null
├── humanScores: HumanScores | null
├── generationTimeMs: integer
├── judgingTimeMs: integer
└── error: string | null

EvalResult (multi-shot, N>1 — selected variant promoted to top level)
├── prompt: TestPrompt
├── status: "success" | "generation-failed" | "judge-failed"
├── commands: DrawingCommand[] | null          ← from selected variant
├── pixels: integer[][] | null                 ← from selected variant
├── palette: Color[] | null                    ← from selected variant
├── stats: PixelStats | null                   ← from selected variant
├── scores: QualityScore | null                ← from selected variant
├── humanScores: HumanScores | null
├── generationTimeMs: integer                  ← total across all variants
├── judgingTimeMs: integer                      ← total across all variants
├── error: string | null
├── selectedVariantIndex: integer              ← NEW: index into variants array
└── variants: SpriteVariant[]                  ← NEW: all generation attempts
```

### SpriteVariant (new — one generation attempt)

```
SpriteVariant
├── commands: DrawingCommand[]
├── pixels: integer[][]
├── palette: Color[]
├── stats: PixelStats
├── scores: QualityScore
├── generationTimeMs: integer
├── judgingTimeMs: integer
└── error: string | null
```

## Modified Dimension Configuration

### spatialCoverage — moved from code-based to LLM-judged

**Before**: Deterministic score from `computeCodeBasedScores()` using coverage percentage thresholds.

**After**: LLM-judged dimension in `llmDimensions` array, receiving vision (PNG + ASCII grid). The rubric description is updated to instruct the judge to consider the subject's natural shape.

**Code-based dimensions remaining**: `detailDensity` only (1 code-based, 5 LLM-judged).

The raw coverage percentage remains in `PixelStats` and is included in the judge's `<pixel_statistics>` block as supplementary context.

## Prompt Set Expansion

### Category Distribution (30 prompts)

```
vehicles:   6 prompts (2 simple, 2 medium, 2 hard)
characters: 6 prompts (2 simple, 2 medium, 2 hard)
tiles:      6 prompts (3 simple, 3 medium)
objects:    6 prompts (3 simple, 3 medium)
creatures:  6 prompts (2 simple, 2 medium, 2 hard)
```

### Grid Size by Difficulty

```
simple:  32x32 (tiles, simple objects, basic creatures)
medium:  48x48 (characters, vehicles, detailed objects)
hard:    64x64 (complex vehicles, equipped characters, multi-part creatures)
```
