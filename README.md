# Asset Forge

**Status: Archived** — This project is no longer actively developed but is preserved as a reference.

An experiment in LLM-generated pixel art through structured drawing commands, with a calibrated evaluation harness for measuring sprite quality.

**[Project page](https://matthewdeaves.github.io/assetforge/)**

## What This Is

Asset Forge explored whether LLMs (Claude Sonnet 4.6) could generate quality pixel art by outputting geometric drawing commands (rectangles, circles, ellipses, polygons) that a server-side rasterizer turns into indexed-colour pixel grids.

The project includes:
- A sprite generation pipeline (LLM → drawing commands → rasterizer → pixel grid)
- A calibrated LLM judge (Opus evaluating Sonnet's output) scoring sprites on 6 quality dimensions
- A human grading UI for blind calibration of the judge
- Comparison and evolution pages for tracking quality across iterations
- Classic Mac export tools (PICT format, MacBinary, HFS disk images)

## Key Findings

- **Tiles and simple objects** score well (4.0–5.0/5 human scores)
- **Complex subjects** (dragons, knights, vehicles) produce recognisable blobs but not quality pixel art
- **More prescriptive generation prompts made things worse** — the baseline prompt outperformed both v2 (-0.16) and v3 (-0.45)
- **Judge calibration** went from MAD >1.3 (broken) to MAD 0.61 (spatial coverage, best dimension) over 5 rounds
- **Vision was critical** — giving the judge the rendered PNG dramatically improved prompt adherence scoring

See the [project page](https://matthewdeaves.github.io/assetforge/) for the full story with sprite examples and calibration data.

## Useful Parts (for future projects)

### Classic Mac Export Tools (`tools/`)

C binaries for creating classic Macintosh graphics files:

- **`grid2pict`** — Converts JSON sprite data (palette + pixel grid) to PICT format
- **`pict2macbin`** — Wraps PICT files in MacBinary format for classic Mac transfer
- **`picts2dsk`** — Packs multiple PICT files into an HFS disk image (.dsk) using bundled libhfs

```bash
# Build all tools
cd tools && make

# Convert a sprite JSON to PICT
./grid2pict input.json output.pict

# Wrap in MacBinary
./pict2macbin output.pict output.bin

# Create an HFS disk image with multiple PICTs
./picts2dsk output.dsk sprite1.pict sprite2.pict ...
```

These tools have no dependencies beyond gcc and libc. The libhfs library is bundled in `tools/libhfs/`.

### Eval Harness (`eval/`)

The evaluation harness and calibrated judge could be adapted for other generative quality assessment tasks:

- Per-dimension LLM judging with vision (PNG + ASCII grid)
- Blind human grading UI with calibration metrics
- Multi-shot generation (best of N variants)
- Score-level anchored rubrics

## Running Locally

```bash
# Docker (recommended)
docker compose up -d
# Open http://localhost:3777

# Or without Docker
cd server && npm install
node server/index.js

# Run an eval
node eval/run.js
node eval/run.js --variants 3
```

Requires an OpenRouter API key in `openrouterkey` file or `OPENROUTER_API_KEY` env var.

## Tech Stack

- Node.js 20 LTS, Express, plain HTML/CSS/JS (no framework)
- OpenRouter API (Claude Sonnet for generation, Claude Opus for judging)
- C tools for classic Mac export (PICT, MacBinary, HFS)
- Docker for deployment

## Licence

MIT
