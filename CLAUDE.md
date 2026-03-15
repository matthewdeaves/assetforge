# tanks Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-03-15

## Active Technologies
- File system — JSON files in per-project directories (001-asset-forge-service)
- Node.js 20 LTS (same as Asset Forge server) + Existing `server/services/rasterizer.js` and `server/services/llm.js` from Asset Forge (002-sprite-eval-harness)
- JSON files for prompt sets (input) and result reports (output) (002-sprite-eval-harness)
- Node.js 20 LTS (same as Asset Forge server) + Plain HTML/CSS/JS (frontend) + Existing Express server (`server/index.js`), existing eval harness (`eval/`) (003-human-grading-ui)
- JSON files — human scores written back into existing eval report files in `eval/results/` (003-human-grading-ui)
- JSON files — eval reports in `eval/results/`, prompt sets in `eval/prompt-sets/` (005-eval-harness-improvements)

- Node.js 20 LTS (server), plain HTML/CSS/JS (frontend) + OpenRouter SDK (LLM), Express (HTTP server) (001-asset-forge-service)

## Project Structure

```text
src/
tests/
```

## Commands

# Add commands for Node.js 20 LTS (server), plain HTML/CSS/JS (frontend)

## Code Style

Node.js 20 LTS (server), plain HTML/CSS/JS (frontend): Follow standard conventions

## Recent Changes
- 005-eval-harness-improvements: Added Node.js 20 LTS (same as Asset Forge server) + Plain HTML/CSS/JS (frontend) + Existing Express server (`server/index.js`), existing eval harness (`eval/`)
- 003-human-grading-ui: Added Node.js 20 LTS (same as Asset Forge server) + Plain HTML/CSS/JS (frontend) + Existing Express server (`server/index.js`), existing eval harness (`eval/`)
- 003-human-grading-ui: Added Node.js 20 LTS (same as Asset Forge server) + Plain HTML/CSS/JS (frontend) + Existing Express server (`server/index.js`), existing eval harness (`eval/`)


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
