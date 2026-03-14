# Implementation Plan: Sprite Generation Eval Harness

**Branch**: `002-sprite-eval-harness` | **Date**: 2026-03-14 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-sprite-eval-harness/spec.md`

## Summary

Build a command-line Node.js tool that evaluates sprite generation quality by running a batch of test prompts through the existing Asset Forge generation pipeline, then scoring each result using an LLM-as-judge approach across 5 quality dimensions. Results are saved as JSON reports for A/B comparison of system prompts and quality tracking over time.

## Technical Context

**Language/Version**: Node.js 20 LTS (same as Asset Forge server)
**Primary Dependencies**: Existing `server/services/rasterizer.js` and `server/services/llm.js` from Asset Forge
**Storage**: JSON files for prompt sets (input) and result reports (output)
**Testing**: Manual — run eval, inspect scores and reports
**Target Platform**: CLI tool, runs on same machine as Asset Forge (or in Docker container)
**Project Type**: CLI tool (Node.js script)
**Performance Goals**: Complete 10-prompt eval in under 15 minutes (LLM-bound)
**Constraints**: Reuses existing services, no new dependencies. Sequential prompt evaluation (one at a time to avoid rate limits).
**Scale/Scope**: ~4 source files, 1 default prompt set, output to eval/results/

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. LLM-Powered Sprite Generation via Drawing Commands | PASS | Eval harness tests and improves the quality of this exact pipeline |
| II. Browser Preview via Scaled Grid | N/A | CLI tool — no browser preview; pixel data used for stats/judge only |
| III. Classic Mac Export | N/A | Eval does not export; it evaluates generation quality |
| IV. Project Organization | PASS | Does not change project structure |
| V. Docker-First | PASS | Can run inside Docker container or locally |
| VI. No Scope Creep | PASS | This is a development tool that directly improves the core pipeline's output quality |

## Project Structure

### Documentation (this feature)

```text
specs/002-sprite-eval-harness/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
eval/
├── run.js                    # Main CLI entry point
├── judge.js                  # LLM-as-judge scoring service
├── stats.js                  # Pixel statistics calculator (color distribution, coverage)
├── prompt-sets/
│   └── default.json          # Default test prompt set (5 categories, 10-15 prompts)
├── system-prompts/
│   └── current.js            # Exports the current system prompt (extracted from llm.js)
└── results/                  # Output directory for eval reports (gitignored)
    └── {version}_{timestamp}.json
```

**Structure Decision**: The eval tool lives in `eval/` at the repo root, alongside `server/` and `public/`. It imports from `server/services/` directly via relative paths. System prompts are stored as JS modules that export the prompt string so they can be versioned and A/B tested. The `eval/results/` directory is gitignored since reports contain large pixel arrays.

## Complexity Tracking

No constitution violations. No complexity justifications needed.
