# Data Model: Judge Vision & Calibration Improvements

## Modified Entities

### DIMENSION_RUBRICS (eval/judge.js) — extended

Current rubric object structure gains an optional `preCheck` workflow instruction:

```
DimensionRubric
├── name: string                    # Display name
├── description: string             # Scoring guidance (MODIFIED for promptAdherence, componentSeparation)
├── anchors: { 1..5: string }      # Score-level descriptions (score 4 tightened for promptAdherence)
```

No new fields on the rubric data object. Pre-check logic is embedded in `buildJudgePrompt()` instruction template.

### Judge Prompt Structure — extended

Current prompt structure gains image and ASCII context:

```
JudgeUserMessage (text content)
├── <sprite_evaluation>
│   ├── <original_prompt>           # Existing
│   ├── <quality_hint>              # Existing (optional)
│   ├── <grid_dimensions>           # Existing
│   ├── <pixel_statistics>          # Existing
│   ├── <rendered_pixels>           # NEW: ASCII grid representation
│   └── <drawing_commands>          # Existing
```

```
JudgeUserMessage (image content — NEW)
├── 4x-scaled PNG of rasterized sprite (base64 inline)
```

### callOpenRouter Signature — extended

```
callOpenRouter(systemPrompt, userMessage, modelOverride, imageBase64?)
                                                          ^^^^^^^^^^^
                                                          NEW optional parameter
```

When `imageBase64` is provided, user message becomes a content array:
```json
[
  { "type": "text", "text": "<sprite_evaluation>..." },
  { "type": "image_url", "image_url": { "url": "data:image/png;base64,..." } }
]
```

### judgeSprite Signature — extended

```
judgeSprite(prompt, commands, stats, hint, judgeModel, width, height, pixels, palette)
                                                                      ^^^^^^  ^^^^^^^
                                                                      NEW parameters
```

`pixels` (number[][]) and `palette` ({r,g,b}[]) are needed for both ASCII grid generation and PNG rendering.

## New Entities

### ASCII Grid (computed, not stored)

Text representation of rasterized pixel array for inclusion in judge prompt.

```
ASCIIGrid
├── text: string          # One line per row, characters mapped from palette index
├── width: number         # Same as sprite width
├── height: number        # Same as sprite height
├── characterMap: Map<number, string>  # palette index → display character
```

Character mapping:
- Index 0 (transparent): `·`
- Indices 1-9: `1`-`9`
- Indices 10-15: `A`-`F`
- Indices 16+: `G`-`Z`, then `a`-`z`

### PNG Buffer (computed, not stored)

4x-scaled PNG of rasterized sprite for vision input.

```
SpriteImage
├── buffer: Buffer        # PNG file data
├── base64: string        # Base64 encoding of buffer
├── width: number         # sprite width × 4
├── height: number        # sprite height × 4
```

### Worst Disagreement (computed client-side, not stored)

Per-sprite calibration delta for the worst-disagreement UI table.

```
SpriteDisagreement
├── promptText: string
├── deltas: { [dimension]: number }   # human - llm (positive = LLM under-scored)
├── totalAbsDelta: number             # sum of |delta| across dimensions
```

## New Files

### eval/png-encoder.js

```
Module exports:
├── renderToPNG(pixels, palette, scale?) → Buffer
```

### eval/system-prompts/v2.js

```
Module exports:
├── buildSystemPrompt(width, height) → string
```

## Data Flow Changes

### Current Judge Flow
```
prompt + commands + stats → buildUserMessage() → text → callOpenRouter() → score
```

### New Judge Flow
```
prompt + commands + stats + pixels + palette
  → pixelsToAscii(pixels) → ASCII grid text
  → renderToPNG(pixels, palette) → base64 PNG
  → buildUserMessage() → text with <rendered_pixels>
  → callOpenRouter(system, text, model, base64PNG) → score
```

### Parallel Execution
```
Current:  dim1 → dim2 → dim3  (sequential)
New:      Promise.all([dim1, dim2, dim3])  (parallel)
```
