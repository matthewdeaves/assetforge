# Quickstart: Eval Harness Improvements

## Run an Eval with the Expanded Prompt Set

```bash
# Single-shot (30 prompts, mixed grid sizes)
node eval/run.js

# Best-of-3 variants (30 prompts × 3 = 90 generations)
node eval/run.js --variants 3
```

## Review Results

1. Open http://localhost:3777/review.html
2. Select the latest report from the dropdown
3. Grade each sprite on 6 dimensions (spatial coverage is now LLM-judged)
4. For multi-shot reports, use the variant selector to browse alternatives

## Compare Rounds

Open http://localhost:3777/comparison.html to see:
- Per-prompt sprite evolution across rounds
- Calibration metrics over time
- Worst disagreements between human and LLM scores
- Per-category score breakdowns

## Verify Improvements

After grading, check:
- Spatial coverage MAD should be below 0.85 (was 0.95 with code-based)
- Complex subjects on larger grids should score higher on component separation and prompt adherence
- Multi-shot selected variants should average 0.3+ points above rejected variants
