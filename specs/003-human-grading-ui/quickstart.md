# Quickstart: Human Grading Review UI

## Prerequisites

- Asset Forge server running (`docker compose up` or `node server/index.js`)
- At least one eval report in `eval/results/` (run `node eval/run.js` first)

## Grade Sprites

1. Start the server if not running:
   ```bash
   node server/index.js
   ```

2. Open the review page:
   ```
   http://localhost:3777/review.html
   ```

3. Select a report from the dropdown (most recent is pre-selected)

4. For each sprite:
   - View the rendered sprite and read the prompt
   - Score each dimension 1-5 using the buttons
   - Click "Next" to advance, or "Skip" to skip

5. Click "Finish" when done (or after all sprites)

6. View the calibration summary comparing your scores vs the LLM judge

## Calibration Summary

After grading, the summary shows:

| Dimension | Human Avg | LLM Avg | Difference | Agreement |
|-----------|-----------|---------|------------|-----------|
| Component Separation | 3.2 | 4.1 | 0.9 | 80% |
| Color Usage | 2.8 | 3.5 | 0.7 | 70% |
| **Prompt Adherence** | **2.1** | **4.2** | **2.1** | **30%** |

Dimensions with >1 point average difference are highlighted — these indicate the LLM judge needs rubric adjustments.

## Re-Grading

If a report already has human scores, you'll see options to:
- **View Results**: Jump straight to the calibration summary
- **Re-Grade**: Start fresh (replaces existing human scores)
