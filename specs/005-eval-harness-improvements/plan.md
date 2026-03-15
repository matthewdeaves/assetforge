# Implementation Plan: Eval Harness Improvements

**Branch**: `005-eval-harness-improvements` | **Date**: 2026-03-15 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/005-eval-harness-improvements/spec.md`

## Summary

Improve the eval harness with richer test prompts (30 prompts with category/difficulty/colour hints), per-prompt grid sizes (32-64px), multi-shot generation (best of N variants), and LLM-judged spatial coverage (replacing the worst-calibrated code-based dimension). These changes improve the quality signal from the eval pipeline without changing the generation prompt itself.

## Technical Context

**Language/Version**: Node.js 20 LTS (same as Asset Forge server) + Plain HTML/CSS/JS (frontend)
**Primary Dependencies**: Existing Express server (`server/index.js`), existing eval harness (`eval/`)
**Storage**: JSON files — eval reports in `eval/results/`, prompt sets in `eval/prompt-sets/`
**Testing**: Manual — run eval, human-grade, compare calibration metrics
**Target Platform**: Docker container (linux/amd64)
**Project Type**: CLI eval harness + web service
**Performance Goals**: Multi-shot with N=3 should complete within 3x single-shot time (generation is the bottleneck, judging is parallel)
**Constraints**: OpenRouter API rate limits (~60 req/min). Multi-shot multiplies generation calls by N.
**Scale/Scope**: 30 test prompts × up to 3 variants = 90 generations max per eval run

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. LLM-Powered Sprite Generation via Drawing Commands | PASS | No changes to generation pipeline — only to prompt inputs and eval infrastructure |
| II. Browser Preview via Scaled Grid | PASS | Review UI changes are additive (variant browsing) |
| III. Classic Mac Export | N/A | No export changes |
| IV. Project Organization | N/A | Eval harness is separate from project management |
| V. Docker-First | PASS | Runs within existing Docker container |
| VI. No Scope Creep | PASS | All changes serve the eval/calibration pipeline |

## Project Structure

### Documentation (this feature)

```text
specs/005-eval-harness-improvements/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
eval/
├── run.js               # MODIFY: --variants flag, multi-shot loop, variant selection
├── judge.js             # MODIFY: move spatialCoverage to llmDimensions
├── prompt-sets/
│   └── default.json     # MODIFY: expand to 30 prompts, add difficulty/colours/components

public/
├── js/
│   ├── review.js        # MODIFY: variant browsing in review UI
│   └── comparison.js    # MODIFY: handle mixed grid sizes, variant data
```

**Structure Decision**: All changes are within existing directory structure. No new files needed — only modifications to existing eval harness files and the prompt set.

## Complexity Tracking

No constitution violations. No complexity justifications needed.
