# Implementation Plan: Human Grading Review UI

**Branch**: `003-human-grading-ui` | **Date**: 2026-03-14 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/003-human-grading-ui/spec.md`

## Summary

Build a browser-based sprite review page served by the existing Asset Forge Express server that renders generated sprites on an HTML canvas and lets the developer score them on 5 quality dimensions (1-5 scale). LLM scores are hidden during grading to prevent anchoring bias. After grading, a calibration summary compares human vs LLM scores to identify judge accuracy issues. Human scores are saved back into the eval report JSON.

## Technical Context

**Language/Version**: Node.js 20 LTS (same as Asset Forge server) + Plain HTML/CSS/JS (frontend)
**Primary Dependencies**: Existing Express server (`server/index.js`), existing eval harness (`eval/`)
**Storage**: JSON files — human scores written back into existing eval report files in `eval/results/`
**Testing**: Manual — grade sprites, verify calibration table accuracy, verify persistence
**Target Platform**: Browser page served at `http://localhost:3777/review.html`
**Project Type**: Web page addition to existing web service
**Performance Goals**: None — developer tool, single user, small data sets (10-50 sprites per report)
**Constraints**: No new dependencies. Plain HTML/CSS/JS only (constitution: no SPA framework). Must integrate with existing Express server and eval report JSON format.
**Scale/Scope**: 1 HTML page, 1 JS file, 1 CSS file, 1 API route file, ~3 endpoints

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. LLM-Powered Sprite Generation via Drawing Commands | PASS | Does not modify generation — reads and displays existing sprite data |
| II. Browser Preview via Scaled Grid | PASS | Renders sprites on canvas using same pixel grid and palette system |
| III. Classic Mac Export | N/A | No export functionality |
| IV. Project Organization | PASS | Adds to existing server and public directories |
| V. Docker-First | PASS | Runs within existing Docker container |
| VI. No Scope Creep | PASS | Development tool that directly supports improving sprite generation quality via judge calibration |

## Project Structure

### Documentation (this feature)

```text
specs/003-human-grading-ui/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── api.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
public/
├── review.html              # Human grading review page
├── css/
│   └── review.css           # Styles for the review page
└── js/
    └── review.js            # Client-side grading logic, canvas rendering, calibration

server/
└── routes/
    └── eval.js              # API routes: list reports, get report, save human scores
```

**Structure Decision**: Follows the existing Asset Forge pattern — static HTML/CSS/JS in `public/`, API routes in `server/routes/`. No new directories needed. The eval route file is added alongside the existing `projects.js`, `sprites.js`, and `export.js` routes.

## Complexity Tracking

No constitution violations. No complexity justifications needed.
