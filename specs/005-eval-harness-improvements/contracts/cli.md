# CLI Contract: Eval Harness Improvements

## Modified Command

### `node eval/run.js`

**New flag**:
```
--variants N    Number of generation attempts per prompt (default: 1)
```

**Examples**:
```bash
# Single-shot (current behaviour, backward compatible)
node eval/run.js

# Best-of-3 variants per prompt
node eval/run.js --variants 3

# With system prompt and variants
node eval/run.js --system-prompt current --variants 3
```

**Validation**:
- `--variants 0` → treated as 1
- `--variants` without a number → error with usage message
- Non-integer values → error with usage message

**Console output changes** (multi-shot mode):
```
[1/30] "top-down military tank..." (variant 1/3)
  → Variant 1: Overall 3.8/5
[1/30] "top-down military tank..." (variant 2/3)
  → Variant 2: Overall 4.2/5
[1/30] "top-down military tank..." (variant 3/3)
  → Variant 3: Overall 4.5/5
  ★ Selected variant 3 (4.5/5) | Coverage: 68% | Commands: 63 (54.0s gen, 19.4s judge)
```

## Report Structure Changes

### Single-shot (N=1) — unchanged
```json
{
  "results": [
    {
      "prompt": { "prompt": "...", "width": 64, "height": 64, "category": "vehicles", ... },
      "status": "success",
      "commands": [...],
      "pixels": [[...]],
      "scores": { ... }
    }
  ]
}
```

### Multi-shot (N>1) — selected variant at top level, all variants stored
```json
{
  "variantsPerPrompt": 3,
  "results": [
    {
      "prompt": { "prompt": "...", "width": 64, "height": 64, "category": "vehicles", ... },
      "status": "success",
      "commands": [...],
      "pixels": [[...]],
      "scores": { ... },
      "selectedVariantIndex": 2,
      "variants": [
        { "commands": [...], "pixels": [[...]], "scores": { ... }, "generationTimeMs": 18000, "judgingTimeMs": 19000 },
        { "commands": [...], "pixels": [[...]], "scores": { ... }, "generationTimeMs": 17000, "judgingTimeMs": 20000 },
        { "commands": [...], "pixels": [[...]], "scores": { ... }, "generationTimeMs": 19000, "judgingTimeMs": 18000 }
      ]
    }
  ]
}
```
