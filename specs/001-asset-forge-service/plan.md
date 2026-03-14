# Implementation Plan: Asset Forge Service

**Branch**: `001-asset-forge-service` | **Date**: 2026-03-14 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-asset-forge-service/spec.md`

## Summary

Build a Dockerized Node.js web service that lets users create projects, generate palette-indexed pixel-art sprites via LLM prompts through OpenRouter, preview them in a scaled browser grid viewport, iterate on existing sprites, and export for classic Macintosh. Single sprites export as MacBinary .bin files; all project sprites export as an HFS disk image (.dsk). Export tooling: `grid2pict` and `pict2macbin` (already built), `picts2dsk` (to be built using bundled libhfs from Retro68).

## Technical Context

**Language/Version**: Node.js 20 LTS (server), plain HTML/CSS/JS (frontend)
**Primary Dependencies**: OpenRouter SDK (LLM), Express (HTTP server)
**Storage**: File system — JSON files in per-project directories
**Testing**: Manual testing against Docker container + PICT verification on Mac OS 7 emulator (QemuMac Quadra 800)
**Target Platform**: Linux Docker container serving browser UI
**Project Type**: Web service (single container, server + static frontend)
**Performance Goals**: Single user, interactive response times (excluding LLM latency)
**Constraints**: No database, no SPA framework, no auth, no ORM. File-based storage only.
**API Key**: OpenRouter key stored in `openrouterkey` file at project root (gitignored), read by docker-compose
**Scale/Scope**: Single user tool, ~6 screens, ~14 API endpoints

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. LLM-Powered Grid Sprite Generation | PASS | OpenRouter SDK, palette in prompt, iteration workflow |
| II. Browser Preview via Scaled Grid | PASS | Canvas rendering, adjustable zoom, grid overlay |
| III. Classic Mac Export | PASS | .bin via grid2pict + pict2macbin (verified on real Mac), .dsk via picts2dsk (to be built) |
| IV. Project Organization | PASS | Per-project directories with manifest + JSON sprites |
| V. Docker-First | PASS | Single docker-compose.yml, C tools compiled in container |
| VI. No Scope Creep | PASS | No auth, no accounts, no framework, no editor, file storage |

## Project Structure

### Documentation (this feature)

```text
specs/001-asset-forge-service/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── api.md
└── tasks.md
```

### Source Code (repository root)

```text
archive/                     # Legacy HTML reference files (preserved)
├── index.html               # Tank sprite viewer (reference)
├── game-assets.html         # Complete asset preview (reference)
├── maps.html                # Map tiles viewer (reference)
├── export.html              # Export preview (reference)
├── export-sprites.js        # Legacy sprite exporter (reference)
├── make-macbinary.js        # Legacy MacBinary creator (reference)
└── build-mac-resources.sh   # Legacy build script (reference)

tools/                       # C export tools
├── grid2pict.c              # JSON sprite → PICT 2.0 (already built)
├── pict2macbin.c            # PICT → MacBinary wrapper (already built)
├── picts2dsk.c              # Multiple PICTs → HFS disk image (.dsk)
├── libhfs/                  # HFS library (bundled from Retro68)
├── copy-to-shared.sh        # QemuMac shared disk helper
├── test_sprite.json         # Test data
└── Makefile

server/                      # Node.js backend
├── index.js                 # Express server entry point
├── routes/
│   ├── projects.js          # Project CRUD endpoints
│   ├── sprites.js           # Sprite generation + management
│   └── export.js            # PICT export endpoint
├── services/
│   ├── llm.js               # OpenRouter integration
│   ├── projects.js          # File-system project storage
│   └── export.js            # grid2pict + pict2macbin + picts2dsk orchestration
└── package.json

public/                      # Static frontend
├── index.html               # App shell with client-side view switching
├── css/
│   └── style.css            # Dark theme, grid viewport styles
└── js/
    ├── app.js               # Main app logic, routing
    ├── grid-renderer.js     # Canvas-based grid viewport
    ├── api.js               # Server API client
    └── components/
        ├── project-list.js  # Project selection screen
        ├── sprite-gen.js    # Prompt + generate screen
        ├── library.js       # Asset library browser
        ├── palette-editor.js # Palette generation + color picker editing
        └── export.js        # Export UI

data/                        # Runtime data (gitignored, Docker volume)
└── projects/
    └── {project-id}/
        ├── manifest.json    # Project metadata + palette
        └── sprites/
            └── {sprite-id}.json

docker-compose.yml
Dockerfile
```

**Structure Decision**: Single project with `server/` for backend, `public/` for frontend static files, `tools/` for existing C export utilities. Legacy HTML files moved to `archive/` — they were reference implementations and prototypes, not part of the final service. The `data/` directory is a Docker volume for runtime project storage.

## Complexity Tracking

No constitution violations. No complexity justifications needed.
