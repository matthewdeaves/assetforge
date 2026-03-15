# API Contracts: Judge Vision & Calibration Improvements

## New Endpoint

### GET /api/rubrics

Returns the current dimension rubrics from `judge.js` for use by the review UI.

**Response** (200):
```json
{
  "dimensions": {
    "componentSeparation": {
      "name": "Component Separation",
      "description": "...",
      "anchors": { "1": "...", "2": "...", "3": "...", "4": "...", "5": "..." }
    },
    "colorUsage": { ... },
    "detailDensity": { ... },
    "spatialCoverage": { ... },
    "promptAdherence": { ... }
  }
}
```

## Modified Internal APIs

### callOpenRouter (server/services/llm.js)

New optional 4th parameter for vision:

```js
// Before
callOpenRouter(systemPrompt, userMessage, modelOverride)

// After (backward compatible)
callOpenRouter(systemPrompt, userMessage, modelOverride, imageBase64)
```

### judgeSprite (eval/judge.js)

New required parameters for pixel data:

```js
// Before
judgeSprite(prompt, commands, stats, hint, judgeModel, width, height)

// After
judgeSprite(prompt, commands, stats, hint, judgeModel, width, height, pixels, palette)
```

### renderToPNG (eval/png-encoder.js — NEW)

```js
// Returns PNG buffer
renderToPNG(pixels, palette, scale = 4) → Buffer
```

### pixelsToAscii (eval/judge.js — NEW export)

```js
// Returns multi-line string
pixelsToAscii(pixels) → string
```
