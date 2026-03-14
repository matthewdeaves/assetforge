# Research: Asset Forge Service

## R-001: OpenRouter SDK for Node.js

**Decision**: Use the `openrouter` npm package or direct HTTP calls to the OpenRouter API.

**Rationale**: OpenRouter provides a unified API across multiple LLM providers. The API is OpenAI-compatible, so we can use `fetch()` with the standard chat completions endpoint. No heavy SDK needed — a simple HTTP POST with JSON body.

**Alternatives considered**:
- Direct OpenAI SDK: Locked to one provider, OpenRouter gives model flexibility
- Anthropic SDK: Same issue — OpenRouter abstracts the provider choice

**Key details**:
- Endpoint: `https://openrouter.ai/api/v1/chat/completions`
- Auth: `Authorization: Bearer $OPENROUTER_API_KEY`
- The system prompt includes the palette definition and grid size
- The LLM response must be parsed as a JSON 2D array of integers
- Model selection can be configurable (default to a capable model for structured output)

## R-002: LLM Prompt Design for Pixel Grid Output

**Decision**: Use a system prompt that defines the palette, grid dimensions, and output format. The LLM returns a JSON 2D array of palette indices.

**Rationale**: Tested approach — the existing HTML tools already demonstrate this format works. The LLM needs to be told exactly what palette indices are available and what size grid to fill.

**Key details**:
- System prompt includes: palette as indexed list with color names, target width/height, output format instruction (JSON 2D array)
- For iteration: include the existing sprite's pixel data in the prompt as context
- Keep prompts simple — don't over-engineer validation (per constitution)

## R-003: Grid Viewport Rendering

**Decision**: Use HTML5 Canvas for grid rendering instead of CSS grid.

**Rationale**: CSS grid with thousands of DOM elements (e.g., 64x64 = 4096 divs) performs poorly. Canvas draws the same grid with a single element and much better performance, especially at larger sprite sizes. The existing HTML reference files use CSS grid, but for the service we should use canvas for scalability.

**Alternatives considered**:
- CSS Grid: Works for small sprites but DOM overhead becomes an issue at 64x64+
- WebGL: Overkill for indexed-color pixel rendering

**Key details**:
- Canvas draws colored rectangles at the current zoom scale
- Grid overlay drawn as lines on top of the pixel data
- Zoom changes just redraw at different cell size — no interpolation
- Palette colors mapped from the project's palette definition

## R-004: File System Storage Layout

**Decision**: Each project is a directory with a manifest.json and a sprites/ subdirectory containing individual sprite JSON files.

**Rationale**: Simple, inspectable, no database dependency. Aligns with constitution principle IV. Projects are identified by a slugified name or UUID. Sprites are identified by UUID.

**Key details**:
- `data/projects/{project-id}/manifest.json` — project name, palette, creation date
- `data/projects/{project-id}/sprites/{sprite-id}.json` — sprite data with metadata
- The `data/` directory is a Docker volume for persistence

## R-005: Export Pipeline Integration

**Decision**: Server shells out to both C tools: `grid2pict` (JSON → PICT) then `pict2macbin` (PICT → MacBinary). Both are already built, tested, and verified on real Mac hardware.

**Rationale**: Both tools are pure C with no dependencies, already compiled in the Docker container. Using them keeps the export logic in one place (the C tools) rather than splitting it between C and Node.js. Temp files are acceptable — the server writes sprite JSON to a temp file, runs `grid2pict`, runs `pict2macbin`, streams the result, and cleans up.

**Alternatives considered**:
- MacBinary wrapping in Node.js: Duplicates logic already in pict2macbin.c, splits export across two languages
- Rewrite both tools in Node.js: Duplicates working, verified C code unnecessarily

## R-006: Docker Setup

**Decision**: Single Dockerfile based on Node.js 20 LTS, with gcc installed to compile the C tools during build.

**Rationale**: The C tools have no external dependencies — just `gcc` to compile. The compiled binaries live in the container alongside the Node.js server.

**Key details**:
- Base image: `node:20-slim`
- Build stage: install `gcc`, compile `grid2pict`
- Runtime: Node.js server + compiled `grid2pict` binary
- `docker-compose.yml` maps port and mounts `data/` volume
- `OPENROUTER_API_KEY` passed as environment variable

## R-007: Project Reorganization

**Decision**: Move legacy HTML files to `archive/` directory. They are reference implementations from prototyping, not part of the service.

**Rationale**: The existing `index.html`, `game-assets.html`, `maps.html`, `export.html`, `export-sprites.js`, `make-macbinary.js`, and `build-mac-resources.sh` are standalone tools with hardcoded sprite data. They informed the design but the service replaces their functionality. Preserving them in `archive/` keeps the history without cluttering the project root.

**Files to archive**:
- `index.html` → `archive/index.html`
- `game-assets.html` → `archive/game-assets.html`
- `maps.html` → `archive/maps.html`
- `export.html` → `archive/export.html`
- `export-sprites.js` → `archive/export-sprites.js`
- `make-macbinary.js` → `archive/make-macbinary.js`
- `build-mac-resources.sh` → `archive/build-mac-resources.sh`
- `export/` → `archive/export/` (legacy export output)
