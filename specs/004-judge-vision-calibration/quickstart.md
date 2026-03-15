# Quickstart: Judge Vision & Calibration Improvements

## Prerequisites

- Node.js 20+
- OpenRouter API key (in `openrouterkey` file or `OPENROUTER_API_KEY` env var)
- Existing eval results with human scores (for calibration comparison)

## Setup

```bash
cd server && npm install pngjs && cd ..
```

## Verify Changes

### Test ASCII grid + image vision
```bash
# Run eval on a small prompt set to verify judge sees image
node eval/run.js --prompt-set default --gen-model anthropic/claude-sonnet-4-6 --judge-model anthropic/claude-opus-4-6
```

### Test v2 system prompt
```bash
node eval/run.js --system-prompt v2 --prompt-set default
```

### Test parallel judging
Compare timing output — judging time per sprite should be ~3x faster than before.

### Test calibration UI
```bash
# Start server
cd server && node index.js
# Open http://localhost:3777/comparison.html
# Verify worst-disagreement table appears below calibration metrics
```

## Validation Gate

After implementing image vision + rubric tightening:
1. Run full eval: `node eval/run.js`
2. Open review page, grade all sprites manually
3. Check comparison page — promptAdherence MAD should be < 0.80 (was 1.11)
4. All dimensions agreement should be > 80%

Only proceed with pixelArtDiscipline dimension and spatialCoverage→LLM changes if MAD targets are not met by existing dimensions.
